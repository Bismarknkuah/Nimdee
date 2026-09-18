import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ctx, tid } from '../common/context/request-context';
import { SendMessageDto, StartThreadDto } from './dto';

/**
 * In-app messaging between parents, teachers and staff.
 * Threads are DIRECT (two people), GROUP (chosen participants) or CLASS (a class teacher and all the
 * guardians of a class). Every participant sees only their own threads; unread counts come from
 * lastReadAt per participant.
 */
@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  private async userNames(ids: string[]) {
    if (!ids.length) return new Map<string, any>();
    const users = await this.prisma.db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, userType: true, avatarUrl: true },
    });
    return new Map(
      users.map((u) => [
        u.id,
        { id: u.id, name: `${u.firstName} ${u.lastName}`, userType: u.userType, avatarUrl: u.avatarUrl },
      ]),
    );
  }

  /** People the current user may message (teachers → parents of their classes and all staff; parents → their children's teachers and admins). */
  async contacts() {
    const c = ctx();
    const db = this.prisma.db;
    if (c.userType === 'PARENT') {
      const links = await db.studentGuardian.findMany({
        where: { guardianId: c.guardianId ?? '-' },
        include: {
          student: {
            select: {
              firstName: true,
              class: {
                select: {
                  name: true,
                  classTeacher: { select: { userId: true } },
                  subjects: { select: { teacher: { select: { userId: true } } } },
                },
              },
            },
          },
        },
      });
      const teacherIds = [
        ...new Set(
          links
            .flatMap((l) => [
              l.student.class?.classTeacher?.userId,
              ...(l.student.class?.subjects.map((s) => s.teacher?.userId) ?? []),
            ])
            .filter(Boolean),
        ),
      ];
      const admins = await db.user.findMany({
        where: { isActive: true, roles: { some: { role: { name: { in: ['School Admin', 'Proprietor', 'Headmaster'] } } } } },
        select: { id: true },
      });
      const names = await this.userNames([...new Set([...teacherIds, ...admins.map((a) => a.id)])]);
      return [...names.values()];
    }
    if (c.userType === 'STUDENT') {
      const s = await db.student.findUnique({
        where: { id: c.studentId ?? '-' },
        select: {
          class: {
            select: {
              classTeacher: { select: { userId: true } },
              subjects: { select: { teacher: { select: { userId: true } } } },
            },
          },
        },
      });
      const ids = [
        ...new Set(
          [s?.class?.classTeacher?.userId, ...(s?.class?.subjects.map((x) => x.teacher?.userId) ?? [])].filter(Boolean),
        ),
      ];
      return [...(await this.userNames(ids)).values()];
    }
    // Staff & teachers: all active staff/teachers plus parents of their classes (teachers) or all parents (admins).
    const staffUsers = await db.user.findMany({
      where: { isActive: true, userType: { in: ['STAFF', 'TEACHER'] }, id: { not: c.userId } },
      select: { id: true, firstName: true, lastName: true, userType: true, avatarUrl: true },
    });
    let parentWhere: any = { isActive: true, userType: 'PARENT' };
    if (c.userType === 'TEACHER' && c.staffId && !c.permissions?.includes('*')) {
      parentWhere = {
        ...parentWhere,
        guardian: {
          students: {
            some: {
              student: {
                class: { OR: [{ classTeacherId: c.staffId }, { subjects: { some: { teacherId: c.staffId } } }] },
              },
            },
          },
        },
      };
    }
    const parents = await db.user.findMany({
      where: parentWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        userType: true,
        avatarUrl: true,
        guardian: {
          select: {
            students: { select: { student: { select: { firstName: true, class: { select: { name: true } } } } } },
          },
        },
      },
      take: 500,
    });
    return [
      ...staffUsers.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        userType: u.userType,
        avatarUrl: u.avatarUrl,
      })),
      ...parents.map((u) => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        userType: u.userType,
        avatarUrl: u.avatarUrl,
        note: u.guardian?.students.map((s) => `${s.student.firstName} (${s.student.class?.name ?? '—'})`).join(', '),
      })),
    ];
  }

  async threads() {
    const c = ctx();
    const parts = await this.prisma.db.messageParticipant.findMany({
      where: { userId: c.userId },
      include: { thread: { include: { participants: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
      orderBy: { thread: { lastMessageAt: 'desc' } },
      take: 100,
    });
    const names = await this.userNames([...new Set(parts.flatMap((p) => p.thread.participants.map((x) => x.userId)))]);
    const unreadCounts = await Promise.all(
      parts.map((p) =>
        this.prisma.db.message.count({
          where: { threadId: p.threadId, senderId: { not: c.userId }, createdAt: { gt: p.lastReadAt ?? new Date(0) } },
        }),
      ),
    );
    return parts.map((p, i) => ({
      id: p.thread.id,
      type: p.thread.type,
      subject: p.thread.subject,
      lastMessageAt: p.thread.lastMessageAt,
      participants: p.thread.participants
        .map((x) => names.get(x.userId) ?? { id: x.userId, name: 'Unknown' })
        .filter((x) => x.id !== c.userId),
      lastMessage: p.thread.messages[0]
        ? {
            body: p.thread.messages[0].body.slice(0, 120),
            senderId: p.thread.messages[0].senderId,
            createdAt: p.thread.messages[0].createdAt,
          }
        : null,
      unread: unreadCounts[i],
    }));
  }

  async unreadCount() {
    const c = ctx();
    const parts = await this.prisma.db.messageParticipant.findMany({
      where: { userId: c.userId },
      select: { threadId: true, lastReadAt: true },
    });
    if (!parts.length) return 0;
    const counts = await Promise.all(
      parts.map((p) =>
        this.prisma.db.message.count({
          where: { threadId: p.threadId, senderId: { not: c.userId }, createdAt: { gt: p.lastReadAt ?? new Date(0) } },
        }),
      ),
    );
    return counts.reduce((a, b) => a + b, 0);
  }

  private async assertParticipant(threadId: string) {
    const p = await this.prisma.db.messageParticipant.findUnique({
      where: { threadId_userId: { threadId, userId: ctx().userId } },
    });
    if (!p) throw new ForbiddenException('You are not part of this conversation');
    return p;
  }

  async thread(id: string) {
    await this.assertParticipant(id);
    const t = await this.prisma.db.messageThread.findUnique({
      where: { id },
      include: { participants: true, messages: { orderBy: { createdAt: 'asc' }, take: 300 } },
    });
    if (!t) throw new NotFoundException('Conversation not found');
    await this.prisma.db.messageParticipant.update({
      where: { threadId_userId: { threadId: id, userId: ctx().userId } },
      data: { lastReadAt: new Date() },
    });
    const names = await this.userNames([
      ...new Set([...t.participants.map((p) => p.userId), ...t.messages.map((m) => m.senderId)]),
    ]);
    return {
      id: t.id,
      type: t.type,
      subject: t.subject,
      participants: t.participants.map((p) => names.get(p.userId) ?? { id: p.userId, name: 'Unknown' }),
      messages: t.messages.map((m) => ({
        ...m,
        sender: names.get(m.senderId) ?? { id: m.senderId, name: 'Unknown' },
        mine: m.senderId === ctx().userId,
      })),
    };
  }

  async start(dto: StartThreadDto) {
    const c = ctx();
    const db = this.prisma.db;
    const type = dto.type ?? (dto.classId ? 'CLASS' : (dto.participantIds?.length ?? 0) > 1 ? 'GROUP' : 'DIRECT');
    let participantIds = [...new Set(dto.participantIds ?? [])];

    if (type === 'CLASS') {
      if (!dto.classId) throw new BadRequestException('classId is required for class conversations');
      if (c.userType === 'PARENT' || c.userType === 'STUDENT')
        throw new ForbiddenException('Only staff can start class conversations');
      const links = await db.studentGuardian.findMany({
        where: { student: { classId: dto.classId, status: 'ACTIVE' } },
        include: { guardian: { select: { userId: true } } },
      });
      participantIds = [...new Set(links.map((l) => l.guardian.userId).filter(Boolean))];
    }
    if (!participantIds.length) throw new BadRequestException('Choose at least one recipient');

    // Parents & students may only message allowed contacts.
    if (c.userType === 'PARENT' || c.userType === 'STUDENT') {
      const allowed = new Set((await this.contacts()).map((x) => x.id));
      if (participantIds.some((id) => !allowed.has(id)))
        throw new ForbiddenException("You can only message your children's teachers and the school office");
    }

    // Re-use an existing direct thread between the same two people.
    if (type === 'DIRECT') {
      const existing = await db.messageThread.findFirst({
        where: {
          type: 'DIRECT',
          participants: { every: { userId: { in: [c.userId, participantIds[0]] } } },
          AND: [
            { participants: { some: { userId: c.userId } } },
            { participants: { some: { userId: participantIds[0] } } },
          ],
        },
      });
      if (existing) {
        await this.send(existing.id, { body: dto.body });
        return this.thread(existing.id);
      }
    }

    const t = await this.prisma.tenantTx(async (tx) => {
      const thread = await tx.messageThread.create({
        data: { tenantId: tid(), type, subject: dto.subject, classId: dto.classId ?? null, createdById: c.userId },
      });
      await tx.messageParticipant.createMany({
        data: [c.userId, ...participantIds].map((userId) => ({
          tenantId: tid(),
          threadId: thread.id,
          userId,
          lastReadAt: userId === c.userId ? new Date() : null,
        })),
      });
      await tx.message.create({
        data: { tenantId: tid(), threadId: thread.id, senderId: c.userId, body: dto.body.trim() },
      });
      return thread;
    });
    await this.notify(t.id, participantIds, dto.body);
    return this.thread(t.id);
  }

  async send(threadId: string, dto: SendMessageDto) {
    await this.assertParticipant(threadId);
    const c = ctx();
    const m = await this.prisma.tenantTx(async (tx) => {
      const created = await tx.message.create({
        data: { tenantId: tid(), threadId, senderId: c.userId, body: dto.body.trim() },
      });
      await tx.messageThread.update({ where: { id: threadId }, data: { lastMessageAt: new Date() } });
      await tx.messageParticipant.update({
        where: { threadId_userId: { threadId, userId: c.userId } },
        data: { lastReadAt: new Date() },
      });
      return created;
    });
    const others = await this.prisma.db.messageParticipant.findMany({
      where: { threadId, userId: { not: c.userId } },
      select: { userId: true },
    });
    await this.notify(
      threadId,
      others.map((o) => o.userId),
      dto.body,
    );
    return { ...m, mine: true };
  }

  private async notify(threadId: string, userIds: string[], body: string) {
    if (!userIds.length) return;
    const from = ctx().actorName ?? 'School';
    await this.prisma.db.notification
      .createMany({
        data: userIds.map((userId) => ({
          tenantId: tid(),
          userId,
          title: `Message from ${from}`,
          body: body.slice(0, 160),
          type: 'MESSAGE',
          data: { threadId },
        })),
      })
      .catch(() => undefined);
  }
}
