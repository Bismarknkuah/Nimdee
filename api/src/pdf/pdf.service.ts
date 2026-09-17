import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

type Doc = PDFKit.PDFDocument;
interface SchoolInfo {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  primaryColor?: string;
  code?: string;
  currency?: string;
}

export interface InvoicePdfData {
  school: any;
  invoice: any;
  student: any;
  guardian?: any;
  currency: string;
}

const money2 = (v: any, cur: string) =>
  `${cur} ${Number(v ?? 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const d8 = (v: any) => (v ? new Date(v).toLocaleDateString('en-GB') : '—');

/** Branded PDF documents (receipts, invoices, statements, report cards, transcripts, payslips, registers, ID cards, timetables). Pure server-side rendering with pdfkit. */
@Injectable()
export class PdfService {
  private render(build: (doc: Doc) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Producer: 'School OS' } });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        build(doc);
        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }

  private header(doc: Doc, school: SchoolInfo, title: string, subtitle?: string) {
    const color = school.primaryColor || '#1d4ed8';
    doc.rect(0, 0, doc.page.width, 90).fill(color);
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(20)
      .text(school.name, 40, 26, { width: doc.page.width - 80 });
    doc
      .font('Helvetica')
      .fontSize(9)
      .text([school.address, school.phone, school.email].filter(Boolean).join('  •  '), 40, 54, {
        width: doc.page.width - 80,
      });
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(16).text(title, 40, 108);
    if (subtitle) doc.font('Helvetica').fontSize(10).fillColor('#4b5563').text(subtitle, 40, 128);
    doc
      .moveTo(40, 146)
      .lineTo(doc.page.width - 40, 146)
      .strokeColor(color)
      .lineWidth(1.5)
      .stroke();
    doc.y = 160;
  }

  private kv(doc: Doc, pairs: Array<[string, string]>, x: number, y: number, colWidth = 250) {
    let yy = y;
    for (const [k, v] of pairs) {
      doc.font('Helvetica').fontSize(9).fillColor('#6b7280').text(k, x, yy, { width: colWidth });
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#111827')
        .text(v || '—', x, yy + 11, { width: colWidth });
      yy += 30;
    }
    return yy;
  }

  private table(
    doc: Doc,
    columns: Array<{ label: string; width: number; align?: 'left' | 'right' | 'center' }>,
    rows: string[][],
    startY: number,
    color = '#1d4ed8',
  ) {
    let y = startY;
    const x0 = 40;
    const rowH = 20;
    const drawHead = () => {
      doc
        .rect(
          x0,
          y,
          columns.reduce((a, c) => a + c.width, 0),
          rowH,
        )
        .fill(color);
      let x = x0;
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
      for (const c of columns) {
        doc.text(c.label, x + 5, y + 6, { width: c.width - 10, align: c.align ?? 'left' });
        x += c.width;
      }
      y += rowH;
    };
    drawHead();
    rows.forEach((r, i) => {
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 40;
        drawHead();
      }
      if (i % 2 === 0)
        doc
          .rect(
            x0,
            y,
            columns.reduce((a, c) => a + c.width, 0),
            rowH,
          )
          .fill('#f3f4f6');
      let x = x0;
      doc.fillColor('#111827').font('Helvetica').fontSize(9);
      r.forEach((cell, j) => {
        const c = columns[j];
        doc.text(cell ?? '', x + 5, y + 6, { width: c.width - 10, align: c.align ?? 'left', lineBreak: false });
        x += c.width;
      });
      y += rowH;
    });
    doc.y = y + 10;
    return y + 10;
  }

  receipt(data: { school: SchoolInfo; payment: any; student: any; invoice?: any; balance: number }) {
    const { school, payment, student, invoice } = data;
    const cur = school.currency || 'GHS';
    return this.render((doc) => {
      this.header(doc, school, 'Official Receipt', `Receipt No. ${payment.receiptNumber}`);
      const y = doc.y;
      this.kv(
        doc,
        [
          ['Received from', `${student.firstName} ${student.lastName} (${student.studentId})`],
          ['Class', student.class?.name ?? '—'],
          ['Payment date', new Date(payment.paidAt).toLocaleString('en-GB')],
        ],
        40,
        y,
      );
      this.kv(
        doc,
        [
          ['Payment method', payment.method],
          ['Reference', payment.reference ?? payment.providerRef ?? '—'],
          ['Recorded by', payment.recordedByName ?? 'School OS'],
        ],
        320,
        y,
      );
      doc.y = y + 100;
      const rows: string[][] = [
        [
          invoice
            ? `Fees — invoice ${invoice.number}`
            : payment.purpose === 'WALLET'
              ? 'Canteen wallet top-up'
              : 'Fees payment (unallocated credit)',
          `${cur} ${Number(payment.amount).toFixed(2)}`,
        ],
      ];
      this.table(
        doc,
        [
          { label: 'Description', width: 380 },
          { label: 'Amount', width: 135, align: 'right' },
        ],
        rows,
        doc.y,
        school.primaryColor,
      );
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#111827')
        .text(`Total received: ${cur} ${Number(payment.amount).toFixed(2)}`, 40, doc.y, { align: 'right', width: 515 });
      if (invoice) {
        doc
          .moveDown(0.5)
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#374151')
          .text(
            `Invoice total ${cur} ${Number(invoice.total).toFixed(2)}  •  Paid to date ${cur} ${Number(invoice.paidTotal).toFixed(2)}  •  Invoice balance ${cur} ${(Number(invoice.total) - Number(invoice.paidTotal)).toFixed(2)}`,
            40,
            doc.y,
            { align: 'right', width: 515 },
          );
      }
      doc.moveDown(0.5).text(`Student account balance: ${cur} ${Number(data.balance).toFixed(2)}`, 40, doc.y, {
        align: 'right',
        width: 515,
      });
      doc
        .moveDown(3)
        .fontSize(8)
        .fillColor('#9ca3af')
        .text('This receipt was generated electronically by School OS and is valid without a signature.', 40, doc.y, {
          align: 'center',
          width: 515,
        });
    });
  }

  reportCard(data: {
    school: SchoolInfo;
    student: any;
    term: any;
    year: any;
    sheet: any;
    scheme: Array<{ grade: string; remark: string }>;
  }) {
    const { school, student, term, year, sheet } = data;
    return this.render((doc) => {
      this.header(doc, school, 'Terminal Report Card', `${year?.name ?? ''} — ${term?.name ?? ''}`);
      const y = doc.y;
      this.kv(
        doc,
        [
          ['Student', `${student.firstName} ${student.otherNames ? student.otherNames + ' ' : ''}${student.lastName}`],
          ['Student ID', student.studentId],
          ['Class', student.class?.name ?? '—'],
        ],
        40,
        y,
      );
      this.kv(
        doc,
        [
          ['Position', sheet.position ? `${sheet.position} of ${sheet.classSize}` : '—'],
          ['Average', `${Number(sheet.average).toFixed(1)}%  (${sheet.overallGrade ?? '—'})`],
          ['Attendance', `${sheet.attendancePresent} / ${sheet.attendanceTotal} days`],
        ],
        320,
        y,
      );
      doc.y = y + 100;
      const subjects: any[] = Array.isArray(sheet.subjects) ? sheet.subjects : [];
      this.table(
        doc,
        [
          { label: 'Subject', width: 175 },
          { label: 'Class score', width: 70, align: 'right' },
          { label: 'Exam score', width: 70, align: 'right' },
          { label: 'Total', width: 55, align: 'right' },
          { label: 'Grade', width: 50, align: 'center' },
          { label: 'Pos.', width: 40, align: 'center' },
          { label: 'Remark', width: 55 },
        ],
        subjects.map((s) => [
          s.name,
          Number(s.ca).toFixed(1),
          Number(s.exam).toFixed(1),
          Number(s.total).toFixed(1),
          s.grade ?? '',
          s.position ? String(s.position) : '',
          s.remark ?? '',
        ]),
        doc.y,
        school.primaryColor,
      );
      const yy = doc.y + 4;
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#111827')
        .text('Conduct: ', 40, yy, { continued: true })
        .font('Helvetica')
        .text(sheet.conduct ?? '—');
      doc
        .moveDown(0.6)
        .font('Helvetica-Bold')
        .text("Class teacher's remark: ", { continued: true })
        .font('Helvetica')
        .text(sheet.classTeacherComment ?? '—');
      doc
        .moveDown(0.6)
        .font('Helvetica-Bold')
        .text("Head teacher's remark: ", { continued: true })
        .font('Helvetica')
        .text(sheet.headComment ?? '—');
      doc
        .moveDown(0.6)
        .font('Helvetica-Bold')
        .text('Promotion status: ', { continued: true })
        .font('Helvetica')
        .text(sheet.promotionStatus ?? '—');
      doc
        .moveDown(1)
        .fontSize(8)
        .fillColor('#6b7280')
        .text('Grading: ' + data.scheme.map((g) => `${g.grade}=${g.remark}`).join(', '), 40, doc.y, { width: 515 });
      doc.moveDown(2);
      const sigY = doc.y + 20;
      doc.moveTo(40, sigY).lineTo(220, sigY).strokeColor('#9ca3af').stroke();
      doc.moveTo(335, sigY).lineTo(515, sigY).stroke();
      doc
        .fontSize(8)
        .fillColor('#6b7280')
        .text('Class teacher', 40, sigY + 4)
        .text('Head teacher', 335, sigY + 4);
      doc
        .fontSize(8)
        .fillColor('#9ca3af')
        .text(
          `Generated by School OS on ${new Date().toLocaleDateString('en-GB')}${sheet.status !== 'PUBLISHED' ? '  •  DRAFT — NOT YET PUBLISHED' : ''}`,
          40,
          doc.page.height - 50,
          { align: 'center', width: 515 },
        );
    });
  }

  // ─────────────────────────── Statements, lists, registers, batch report cards, ID cards ───────────────────────────

  /** Fee invoice with lines, installment schedule and payment history. */
  invoice(data: InvoicePdfData) {
    const { school, invoice: inv, student, guardian, currency } = data;
    return this.render((doc: any) => {
      this.header(
        doc,
        school,
        `Invoice ${inv.number}`,
        `Issued ${d8(inv.issuedAt)} · Due ${d8(inv.dueDate)} · Status: ${String(inv.status).replace('_', ' ')}`,
      );
      const y = doc.y;
      this.kv(
        doc,
        [
          ['Bill to', `${student.firstName} ${student.lastName} (${student.studentId})`],
          ['Class', student.class?.name ?? '—'],
          ['Term', `${inv.term?.name ?? ''} ${inv.academicYear?.name ?? ''}`],
        ],
        40,
        y,
      );
      this.kv(
        doc,
        [
          ['Guardian', guardian ? `${guardian.firstName} ${guardian.lastName}` : '—'],
          ['Phone', guardian?.phone ?? '—'],
          ['Email', guardian?.email ?? '—'],
        ],
        320,
        y,
      );
      doc.y = y + 100;
      this.table(
        doc,
        [
          { label: 'Fee', width: 275 },
          { label: 'Amount', width: 80, align: 'right' },
          { label: 'Discount', width: 80, align: 'right' },
          { label: 'Net', width: 80, align: 'right' },
        ],
        (inv.lines ?? []).map((l: any) => [
          l.description,
          money2(l.amount, currency),
          Number(l.discount) ? money2(l.discount, currency) : '—',
          money2(Number(l.amount) - Number(l.discount), currency),
        ]),
        doc.y,
        school.primaryColor,
      );
      const totals: Array<[string, string]> = [
        ['Subtotal', money2(inv.subtotal, currency)],
        ['Discounts', `− ${money2(inv.discountTotal, currency)}`],
        ['Total', money2(inv.total, currency)],
        ['Paid', money2(inv.paidTotal, currency)],
        ['Balance due', money2(Number(inv.total) - Number(inv.paidTotal), currency)],
      ];
      let ty = doc.y;
      for (const [k, v] of totals) {
        doc
          .font(k === 'Balance due' || k === 'Total' ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(10)
          .fillColor('#111827')
          .text(k, 320, ty, { width: 110 })
          .text(v, 430, ty, { width: 125, align: 'right' });
        ty += 15;
      }
      doc.y = ty + 12;
      if (inv.installments?.length) {
        doc.font('Helvetica-Bold').fontSize(11).text('Installment plan', 40, doc.y);
        doc.y += 6;
        this.table(
          doc,
          [
            { label: '#', width: 40, align: 'center' },
            { label: 'Due date', width: 120 },
            { label: 'Amount', width: 120, align: 'right' },
            { label: 'Paid', width: 120, align: 'right' },
            { label: 'Status', width: 115 },
          ],
          inv.installments.map((i: any) => [
            String(i.sequence),
            d8(i.dueDate),
            money2(i.amount, currency),
            money2(i.paidAmount, currency),
            String(i.status).replace('_', ' '),
          ]),
          doc.y,
          school.primaryColor,
        );
      }
      if (inv.payments?.length) {
        doc.font('Helvetica-Bold').fontSize(11).text('Payments', 40, doc.y);
        doc.y += 6;
        this.table(
          doc,
          [
            { label: 'Receipt', width: 130 },
            { label: 'Date', width: 130 },
            { label: 'Method', width: 130 },
            { label: 'Amount', width: 125, align: 'right' },
          ],
          inv.payments.map((p: any) => [
            p.receiptNumber ?? '—',
            d8(p.paidAt),
            String(p.method).replace('_', ' '),
            money2(p.amount, currency),
          ]),
          doc.y,
          school.primaryColor,
        );
      }
      if (inv.notes)
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#374151')
          .text(`Notes: ${inv.notes}`, 40, doc.y + 4, { width: 515 });
      doc
        .fontSize(8)
        .fillColor('#9ca3af')
        .text(
          'Pay at the school office, by Mobile Money, bank transfer or online through the parent portal. Generated by School OS.',
          40,
          doc.page.height - 50,
          { align: 'center', width: 515 },
        );
    });
  }

  /** Student fee statement: running ledger with invoices and payments. */
  statement(data: any) {
    const { school, student, ledger, invoices, balance, currency } = data;
    return this.render((doc: any) => {
      this.header(
        doc,
        school,
        'Statement of account',
        `${student.firstName} ${student.lastName} · ${student.studentId} · ${student.class?.name ?? ''}`,
      );
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(Number(balance) > 0 ? '#b91c1c' : '#047857')
        .text(`Outstanding balance: ${money2(balance, currency)}`, 40, doc.y);
      doc.y += 20;
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Invoices', 40, doc.y);
      doc.y += 6;
      this.table(
        doc,
        [
          { label: 'Invoice', width: 120 },
          { label: 'Term', width: 120 },
          { label: 'Total', width: 90, align: 'right' },
          { label: 'Paid', width: 90, align: 'right' },
          { label: 'Balance', width: 95, align: 'right' },
        ],
        (invoices ?? []).map((i: any) => [
          i.number,
          `${i.term?.name ?? ''} ${i.term?.academicYear?.name ?? ''}`,
          money2(i.total, currency),
          money2(i.paidTotal, currency),
          money2(Number(i.total) - Number(i.paidTotal), currency),
        ]),
        doc.y,
        school.primaryColor,
      );
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text('Ledger', 40, doc.y);
      doc.y += 6;
      this.table(
        doc,
        [
          { label: 'Date', width: 80 },
          { label: 'Description', width: 215 },
          { label: 'Debit', width: 70, align: 'right' },
          { label: 'Credit', width: 70, align: 'right' },
          { label: 'Balance', width: 80, align: 'right' },
        ],
        [...(ledger ?? [])]
          .reverse()
          .map((l: any) => [
            d8(l.createdAt),
            l.description,
            l.type === 'DEBIT' ? money2(l.amount, currency) : '',
            l.type === 'CREDIT' ? money2(l.amount, currency) : '',
            money2(l.balanceAfter, currency),
          ]),
        doc.y,
        school.primaryColor,
      );
      doc
        .fontSize(8)
        .fillColor('#9ca3af')
        .text(`Generated by School OS on ${new Date().toLocaleDateString('en-GB')}`, 40, doc.page.height - 50, {
          align: 'center',
          width: 515,
        });
    });
  }

  /** Printable class list with guardian contacts. */
  classList(data: any) {
    const { school, cls, students } = data;
    return this.render((doc: any) => {
      this.header(
        doc,
        school,
        `Class list — ${cls.name}`,
        `${students.length} students · Class teacher: ${cls.classTeacher ? `${cls.classTeacher.firstName} ${cls.classTeacher.lastName}` : '—'}`,
      );
      this.table(
        doc,
        [
          { label: '#', width: 30, align: 'center' },
          { label: 'Student ID', width: 105 },
          { label: 'Name', width: 150 },
          { label: 'Gender', width: 55 },
          { label: 'DOB', width: 70 },
          { label: 'Guardian', width: 105 },
        ],
        students.map((s: any, i: number) => [
          String(i + 1),
          s.studentId,
          `${s.lastName}, ${s.firstName}${s.isBoarding ? ' (B)' : ''}`,
          s.gender[0],
          d8(s.dateOfBirth),
          s.guardian ? `${s.guardian.phone}` : '—',
        ]),
        doc.y,
        school.primaryColor,
      );
    });
  }

  /** Blank or filled attendance register for a class and date range (columns per day). */
  attendanceRegister(data: any) {
    const { school, cls, students, dates, marks } = data;
    return this.render((doc: any) => {
      this.header(doc, school, `Attendance register — ${cls.name}`, `${dates[0]} to ${dates[dates.length - 1]}`);
      const dayCols = dates
        .slice(0, 12)
        .map((d: string) => ({ label: d.slice(5), width: 28, align: 'center' as const }));
      this.table(
        doc,
        [
          { label: 'Student', width: 515 - dayCols.length * 28 - 30 },
          { label: 'Σ', width: 30, align: 'center' },
          ...dayCols,
        ],
        students.map((s: any) => {
          const row = dates.slice(0, 12).map((d: string) => {
            const m = marks[`${s.id}|${d}`];
            return m ? m[0] : '';
          });
          const present = dates.filter((d: string) => ['PRESENT', 'LATE'].includes(marks[`${s.id}|${d}`] ?? '')).length;
          return [`${s.lastName}, ${s.firstName}`, String(present), ...row];
        }),
        doc.y,
        school.primaryColor,
      );
      doc
        .fontSize(8)
        .fillColor('#6b7280')
        .text('P present · A absent · L late · E excused · S sick', 40, doc.y + 4);
    });
  }

  /** Every report card of a class in one PDF (one page per student). */
  reportCards(cards: any[]) {
    return this.render((doc: any) => {
      cards.forEach((card, idx) => {
        if (idx > 0) doc.addPage();
        const { school, student, term, year, sheet, scheme } = card;
        this.header(doc, school, 'Terminal Report Card', `${year?.name ?? ''} — ${term?.name ?? ''}`);
        const y = doc.y;
        this.kv(
          doc,
          [
            [
              'Student',
              `${student.firstName} ${student.otherNames ? student.otherNames + ' ' : ''}${student.lastName}`,
            ],
            ['Student ID', student.studentId],
            ['Class', student.class?.name ?? '—'],
          ],
          40,
          y,
        );
        this.kv(
          doc,
          [
            ['Position', sheet.position ? `${sheet.position} of ${sheet.classSize}` : '—'],
            ['Average', `${Number(sheet.average).toFixed(1)}%  (${sheet.overallGrade ?? '—'})`],
            ['Attendance', `${sheet.attendancePresent} / ${sheet.attendanceTotal} days`],
          ],
          320,
          y,
        );
        doc.y = y + 100;
        const subjects: any[] = Array.isArray(sheet.subjects) ? sheet.subjects : [];
        this.table(
          doc,
          [
            { label: 'Subject', width: 175 },
            { label: 'Class score', width: 70, align: 'right' },
            { label: 'Exam score', width: 70, align: 'right' },
            { label: 'Total', width: 55, align: 'right' },
            { label: 'Grade', width: 50, align: 'center' },
            { label: 'Pos.', width: 40, align: 'center' },
            { label: 'Remark', width: 55 },
          ],
          subjects.map((s) => [
            s.name,
            Number(s.ca).toFixed(1),
            Number(s.exam).toFixed(1),
            Number(s.total).toFixed(1),
            s.grade ?? '',
            s.position ? String(s.position) : '',
            s.remark ?? '',
          ]),
          doc.y,
          school.primaryColor,
        );
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#111827')
          .text('Conduct: ', 40, doc.y + 4, { continued: true })
          .font('Helvetica')
          .text(sheet.conduct ?? '—');
        doc
          .moveDown(0.6)
          .font('Helvetica-Bold')
          .text("Class teacher's remark: ", { continued: true })
          .font('Helvetica')
          .text(sheet.classTeacherComment ?? '—');
        doc
          .moveDown(0.6)
          .font('Helvetica-Bold')
          .text("Head teacher's remark: ", { continued: true })
          .font('Helvetica')
          .text(sheet.headComment ?? '—');
        doc
          .moveDown(0.6)
          .font('Helvetica-Bold')
          .text('Promotion status: ', { continued: true })
          .font('Helvetica')
          .text(sheet.promotionStatus ?? '—');
        doc
          .moveDown(1)
          .fontSize(8)
          .fillColor('#6b7280')
          .text('Grading: ' + (scheme ?? []).map((g: any) => `${g.grade}=${g.remark}`).join(', '), 40, doc.y, {
            width: 515,
          });
        doc
          .fontSize(8)
          .fillColor('#9ca3af')
          .text(
            `Generated by School OS on ${new Date().toLocaleDateString('en-GB')}${sheet.status !== 'PUBLISHED' ? '  •  DRAFT — NOT YET PUBLISHED' : ''}`,
            40,
            doc.page.height - 50,
            { align: 'center', width: 515 },
          );
      });
    });
  }

  /** Printable ID cards, 8 per A4 page, with QR codes. */
  async idCards(cards: any[]) {
    const qrs = await Promise.all(cards.map((c) => QRCode.toBuffer(c.qrPayload, { margin: 0, width: 160 })));
    return this.render((doc: any) => {
      const W = 243,
        H = 150,
        GAP = 12;
      cards.forEach((card, i) => {
        const slot = i % 8;
        if (i > 0 && slot === 0) doc.addPage();
        const x = 40 + (slot % 2) * (W + GAP),
          y = 40 + Math.floor(slot / 2) * (H + GAP);
        const { student: s, school, academicYear } = card;
        const color = school.primaryColor || '#1d4ed8';
        doc.roundedRect(x, y, W, H, 8).lineWidth(0.8).strokeColor('#cbd5e1').stroke();
        doc.rect(x, y, W, 28).fill(color);
        doc
          .fillColor('#fff')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(school.name, x + 8, y + 6, { width: W - 16 });
        doc
          .font('Helvetica')
          .fontSize(6)
          .text(`Student identity card · ${academicYear}`, x + 8, y + 17, { width: W - 16 });
        doc.rect(x + 8, y + 36, 46, 56).fill('#f1f5f9');
        doc
          .fillColor('#94a3b8')
          .font('Helvetica-Bold')
          .fontSize(18)
          .text(s.name[0], x + 8, y + 54, { width: 46, align: 'center' });
        doc
          .fillColor('#0f172a')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(s.name, x + 60, y + 36, { width: 110 });
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#334155')
          .text(`ID: ${s.studentId}`, x + 60, y + 62, { width: 110 })
          .text(`Class: ${s.className}`, x + 60, y + 72, { width: 110 })
          .text(`DOB: ${d8(s.dateOfBirth)}`, x + 60, y + 82, { width: 110 })
          .text(`Emergency: ${s.emergencyPhone || '—'}`, x + 60, y + 92, { width: 110 });
        doc.image(qrs[i], x + W - 60, y + 40, { width: 52, height: 52 });
        doc
          .fontSize(5.5)
          .fillColor('#64748b')
          .text(`If found, return to ${school.name}. Scan to verify.`, x + 8, y + H - 16, { width: W - 16 });
      });
    });
  }

  // ─────────────────────────── Payslips, transcripts, timetables ───────────────────────────

  /** Monthly payslip for one staff member. */
  payslip(data: { school: any; run: any; item: any }) {
    const { school, run, item } = data;
    const cur = school.currency || 'GHS';
    return this.render((doc: Doc) => {
      this.header(doc, school, 'Payslip', `Pay period ${run.period}`);
      const y = doc.y;
      this.kv(
        doc,
        [
          ['Employee', `${item.staff.firstName} ${item.staff.lastName}`],
          ['Employee ID', item.staff.employeeId],
          ['Position', item.staff.position ?? '—'],
        ],
        40,
        y,
      );
      this.kv(
        doc,
        [
          ['Department', item.staff.department ?? '—'],
          ['Status', String(run.status)],
          ['Paid on', run.paidAt ? new Date(run.paidAt).toLocaleDateString('en-GB') : '—'],
        ],
        320,
        y,
      );
      doc.y = y + 100;
      this.table(
        doc,
        [
          { label: 'Description', width: 380 },
          { label: 'Amount', width: 135, align: 'right' },
        ],
        [
          ['Basic salary', `${cur} ${Number(item.basic).toFixed(2)}`],
          ['Allowances', `${cur} ${Number(item.allowances).toFixed(2)}`],
          ['Deductions', `- ${cur} ${Number(item.deductions).toFixed(2)}`],
        ],
        doc.y,
        school.primaryColor,
      );
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#111827')
        .text(`Net pay: ${cur} ${Number(item.net).toFixed(2)}`, 40, doc.y, { align: 'right', width: 515 });
      if (item.notes)
        doc
          .moveDown(0.5)
          .font('Helvetica')
          .fontSize(10)
          .fillColor('#374151')
          .text(`Notes: ${item.notes}`, 40, doc.y, { width: 515 });
      doc
        .fontSize(8)
        .fillColor('#9ca3af')
        .text('This payslip is confidential. Generated by School OS.', 40, doc.page.height - 50, {
          align: 'center',
          width: 515,
        });
    });
  }

  /** Academic transcript: every published term for a student. */
  transcript(data: { school: any; student: any; sheets: any[] }) {
    const { school, student, sheets } = data;
    return this.render((doc: Doc) => {
      this.header(
        doc,
        school,
        'Academic Transcript',
        `${student.firstName} ${student.lastName} · ${student.studentId}`,
      );
      for (const s of sheets) {
        if (doc.y > doc.page.height - 200) doc.addPage();
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#111827')
          .text(
            `${s.term?.academicYear?.name ?? ''} — ${s.term?.name ?? ''}   ·   Average ${Number(s.average).toFixed(1)}%  ·  Grade ${s.overallGrade ?? '—'}  ·  Position ${s.position ?? '—'} of ${s.classSize}`,
            40,
            doc.y,
          );
        doc.moveDown(0.3);
        const subjects: any[] = Array.isArray(s.subjects) ? s.subjects.filter((x: any) => x.hasMarks) : [];
        this.table(
          doc,
          [
            { label: 'Subject', width: 235 },
            { label: 'Class', width: 70, align: 'right' },
            { label: 'Exam', width: 70, align: 'right' },
            { label: 'Total', width: 70, align: 'right' },
            { label: 'Grade', width: 70, align: 'center' },
          ],
          subjects.map((x: any) => [
            x.name,
            Number(x.ca).toFixed(1),
            Number(x.exam).toFixed(1),
            Number(x.total).toFixed(1),
            x.grade ?? '',
          ]),
          doc.y,
          school.primaryColor,
        );
      }
      if (!sheets.length)
        doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text('No published results yet.', 40, doc.y);
      doc
        .fontSize(8)
        .fillColor('#9ca3af')
        .text(`Generated by School OS on ${new Date().toLocaleDateString('en-GB')}`, 40, doc.page.height - 50, {
          align: 'center',
          width: 515,
        });
    });
  }

  /** Weekly timetable grid for a class, teacher or room. */
  timetable(data: { school: any; title: string; periods: any[]; slots: any[] }) {
    const { school, title, periods, slots } = data;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    return this.render((doc: Doc) => {
      this.header(doc, school, `Timetable — ${title}`);
      const cell = (d: number, p: any) => {
        if (p.isBreak) return 'Break';
        const s = slots.find((x) => x.dayOfWeek === d && x.periodId === p.id);
        return s
          ? `${s.subject?.name ?? ''}${s.class ? ` (${s.class.name})` : ''}${s.room ? ` · ${s.room.name}` : ''}`
          : '';
      };
      this.table(
        doc,
        [{ label: 'Period', width: 95 }, ...days.map((d) => ({ label: d, width: 84 }))],
        periods.map((p) => [
          `${p.name}\n${p.startTime}-${p.endTime}`.replace('\n', ' '),
          ...days.map((_, i) => cell(i + 1, p)),
        ]),
        doc.y,
        school.primaryColor,
      );
    });
  }
}
