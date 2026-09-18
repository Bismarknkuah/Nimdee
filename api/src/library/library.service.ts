import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { ctx, tid } from '../common/context/request-context';
import { addDays, money, paginate, startOfToday } from '../common/utils';
import { BookDto, BorrowDto, ListBooksDto, ListLoansDto, ReturnDto } from './dto';

const DEFAULT_LOAN_DAYS = 14;
const DEFAULT_FINE_PER_DAY = 1;

/**
 * Library: catalogue with copy counts and a loan ledger with due dates, overdue detection and fines.
 * Copies are decremented on borrow and restored on return (lost copies reduce the total).
 */
@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tenants: TenantCacheService,
  ) {}

  private readonly loanInclude = {
    book: { select: { id: true, title: true, author: true, isbn: true } },
    student: {
      select: { id: true, studentId: true, firstName: true, lastName: true, class: { select: { name: true } } },
    },
    staff: { select: { id: true, employeeId: true, firstName: true, lastName: true } },
  } as const;

  // ── Catalogue ──
  async books(q: ListBooksDto) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.category) where.category = q.category;
    if (q.availableOnly) where.copiesAvailable = { gt: 0 };
    if (q.search)
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { author: { contains: q.search, mode: 'insensitive' } },
        { isbn: { contains: q.search } },
      ];
    const [items, total, categories] = await Promise.all([
      this.prisma.db.libraryBook.findMany({ where, skip, take, orderBy: { title: 'asc' } }),
      this.prisma.db.libraryBook.count({ where }),
      this.prisma.db.libraryBook.groupBy({ by: ['category'], _count: { _all: true }, orderBy: { category: 'asc' } }),
    ]);
    return {
      items,
      total,
      page,
      pageSize,
      categories: categories.map((c) => ({ category: c.category, count: c._count._all })),
    };
  }

  async createBook(dto: BookDto) {
    const copies = dto.copiesTotal ?? 1;
    const b = await this.prisma.db.libraryBook.create({
      data: {
        tenantId: tid(),
        isbn: dto.isbn,
        title: dto.title.trim(),
        author: dto.author.trim(),
        category: dto.category?.toUpperCase() ?? 'GENERAL',
        publisher: dto.publisher,
        year: dto.year,
        copiesTotal: copies,
        copiesAvailable: copies,
        location: dto.location,
      },
    });
    await this.audit.log({
      action: 'LIBRARY_BOOK_ADDED',
      entity: 'LibraryBook',
      entityId: b.id,
      after: { title: b.title, copies },
    });
    return b;
  }

  async updateBook(id: string, dto: Partial<BookDto>) {
    const before = await this.prisma.db.libraryBook.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Book not found');
    let copiesAvailable: number | undefined;
    if (dto.copiesTotal !== undefined) {
      const onLoan = before.copiesTotal - before.copiesAvailable;
      if (dto.copiesTotal < onLoan) throw new BadRequestException(`${onLoan} copies are currently on loan`);
      copiesAvailable = dto.copiesTotal - onLoan;
    }
    return this.prisma.db.libraryBook.update({
      where: { id },
      data: {
        isbn: dto.isbn,
        title: dto.title?.trim(),
        author: dto.author?.trim(),
        category: dto.category?.toUpperCase(),
        publisher: dto.publisher,
        year: dto.year,
        copiesTotal: dto.copiesTotal,
        copiesAvailable,
        location: dto.location,
      },
    });
  }

  async deleteBook(id: string) {
    const active = await this.prisma.db.libraryLoan.count({
      where: { bookId: id, status: { in: ['BORROWED', 'OVERDUE'] } },
    });
    if (active) throw new BadRequestException('Book has copies on loan');
    await this.prisma.db.libraryBook.delete({ where: { id } });
    await this.audit.log({ action: 'LIBRARY_BOOK_REMOVED', entity: 'LibraryBook', entityId: id });
    return { ok: true };
  }

  // ── Loans ──
  async loans(q: ListLoansDto) {
    const { skip, take, page, pageSize } = paginate(q.page, q.pageSize);
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.studentId) where.studentId = q.studentId;
    if (q.bookId) where.bookId = q.bookId;
    if (q.search)
      where.OR = [
        { book: { title: { contains: q.search, mode: 'insensitive' } } },
        { student: { firstName: { contains: q.search, mode: 'insensitive' } } },
        { student: { lastName: { contains: q.search, mode: 'insensitive' } } },
        { staff: { lastName: { contains: q.search, mode: 'insensitive' } } },
      ];
    const [items, total] = await Promise.all([
      this.prisma.db.libraryLoan.findMany({
        where,
        skip,
        take,
        orderBy: { borrowedAt: 'desc' },
        include: this.loanInclude,
      }),
      this.prisma.db.libraryLoan.count({ where }),
    ]);
    return {
      items: items.map((l) => ({
        ...l,
        daysOverdue:
          l.status !== 'RETURNED' && l.dueAt < new Date() ? Math.ceil((Date.now() - l.dueAt.getTime()) / 86400000) : 0,
      })),
      total,
      page,
      pageSize,
    };
  }

  async borrow(dto: BorrowDto) {
    if (!dto.studentId && !dto.staffId) throw new BadRequestException('Choose a student or staff member');
    const loan = await this.prisma.tenantTx(async (tx) => {
      const book = await tx.libraryBook.findUnique({ where: { id: dto.bookId } });
      if (!book) throw new NotFoundException('Book not found');
      if (book.copiesAvailable < 1) throw new BadRequestException('No copies available');
      if (dto.studentId) {
        const open = await tx.libraryLoan.count({
          where: { studentId: dto.studentId, status: { in: ['BORROWED', 'OVERDUE'] } },
        });
        if (open >= 3) throw new BadRequestException('Student already has 3 books on loan');
        const overdue = await tx.libraryLoan.count({ where: { studentId: dto.studentId, status: 'OVERDUE' } });
        if (overdue) throw new BadRequestException('Student has overdue books. Return them first');
      }
      await tx.libraryBook.update({ where: { id: book.id }, data: { copiesAvailable: { decrement: 1 } } });
      return tx.libraryLoan.create({
        data: {
          tenantId: tid(),
          bookId: book.id,
          studentId: dto.studentId ?? null,
          staffId: dto.staffId ?? null,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : addDays(new Date(), DEFAULT_LOAN_DAYS),
          notes: dto.notes,
          issuedById: ctx().userId,
        },
        include: this.loanInclude,
      });
    });
    await this.audit.log({
      action: 'LIBRARY_BOOK_BORROWED',
      entity: 'LibraryLoan',
      entityId: loan.id,
      after: { bookId: dto.bookId, studentId: dto.studentId, staffId: dto.staffId, dueAt: loan.dueAt },
    });
    return loan;
  }

  async returnBook(id: string, dto: ReturnDto) {
    const loan = await this.prisma.tenantTx(async (tx) => {
      const l = await tx.libraryLoan.findUnique({ where: { id } });
      if (!l) throw new NotFoundException('Loan not found');
      if (l.status === 'RETURNED' || l.status === 'LOST') throw new BadRequestException('Loan already closed');
      const daysLate = Math.max(0, Math.ceil((Date.now() - l.dueAt.getTime()) / 86400000));
      const fine = dto.fine !== undefined ? money(dto.fine) : money(daysLate * DEFAULT_FINE_PER_DAY);
      if (dto.lost) {
        await tx.libraryBook.update({ where: { id: l.bookId }, data: { copiesTotal: { decrement: 1 } } });
      } else {
        await tx.libraryBook.update({ where: { id: l.bookId }, data: { copiesAvailable: { increment: 1 } } });
      }
      return tx.libraryLoan.update({
        where: { id },
        data: { status: dto.lost ? 'LOST' : 'RETURNED', returnedAt: new Date(), fine, finePaid: !!dto.finePaid },
        include: this.loanInclude,
      });
    });
    await this.audit.log({
      action: dto.lost ? 'LIBRARY_BOOK_LOST' : 'LIBRARY_BOOK_RETURNED',
      entity: 'LibraryLoan',
      entityId: id,
      after: { fine: Number(loan.fine), finePaid: loan.finePaid },
    });
    return loan;
  }

  async markFinePaid(id: string) {
    const l = await this.prisma.db.libraryLoan.update({ where: { id }, data: { finePaid: true } });
    await this.audit.log({
      action: 'LIBRARY_FINE_PAID',
      entity: 'LibraryLoan',
      entityId: id,
      after: { fine: Number(l.fine) },
    });
    return l;
  }

  /** Flags overdue loans (run nightly and on demand). */
  async markOverdue() {
    const r = await this.prisma.db.libraryLoan.updateMany({
      where: { status: 'BORROWED', dueAt: { lt: startOfToday() } },
      data: { status: 'OVERDUE' },
    });
    return r.count;
  }

  async summary() {
    await this.markOverdue();
    const db = this.prisma.db;
    const [books, copies, onLoan, overdue, finesDue, popular] = await Promise.all([
      db.libraryBook.count(),
      db.libraryBook.aggregate({ _sum: { copiesTotal: true, copiesAvailable: true } }),
      db.libraryLoan.count({ where: { status: { in: ['BORROWED', 'OVERDUE'] } } }),
      db.libraryLoan.findMany({
        where: { status: 'OVERDUE' },
        include: this.loanInclude,
        orderBy: { dueAt: 'asc' },
        take: 20,
      }),
      db.libraryLoan.aggregate({ where: { finePaid: false, fine: { gt: 0 } }, _sum: { fine: true } }),
      db.libraryLoan.groupBy({
        by: ['bookId'],
        _count: { _all: true },
        orderBy: { _count: { bookId: 'desc' } },
        take: 5,
      }),
    ]);
    const popularBooks = popular.length
      ? await db.libraryBook.findMany({
          where: { id: { in: popular.map((p) => p.bookId) } },
          select: { id: true, title: true, author: true },
        })
      : [];
    return {
      titles: books,
      copies: copies._sum.copiesTotal ?? 0,
      available: copies._sum.copiesAvailable ?? 0,
      onLoan,
      overdueCount: overdue.length,
      finesOutstanding: finesDue._sum.fine ?? 0,
      overdue,
      popular: popular.map((p) => ({ ...popularBooks.find((b) => b.id === p.bookId), loans: p._count._all })),
    };
  }

  forStudent(studentId: string) {
    return this.prisma.db.libraryLoan.findMany({
      where: { studentId },
      include: { book: { select: { title: true, author: true } } },
      orderBy: { borrowedAt: 'desc' },
      take: 50,
    });
  }
}
