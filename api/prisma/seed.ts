/* eslint-disable */
/**
 * Development seed: platform owner, plans and a fully populated demo school.
 *   npm run seed            (local)      → creates "Bright Future Academy" (slug: brightfuture)
 * Logins (all passwords: Password123!)
 *   platform:    admin@schoolos.app             school admin: admin@brightfuture.edu.gh       proprietor: proprietor@brightfuture.edu.gh
 *   headmaster:  headmaster@brightfuture.edu.gh class teacher: teacher@brightfuture.edu.gh    form master: formmaster@brightfuture.edu.gh
 *   subj. tchr:  teacher2@brightfuture.edu.gh   accounts:      accounts@brightfuture.edu.gh   canteen:    canteen@brightfuture.edu.gh
 *   nurse:       nurse@brightfuture.edu.gh      librarian:     librarian@brightfuture.edu.gh  HR:         hr@brightfuture.edu.gh
 *   parent:      parent@brightfuture.edu.gh     student:       student@brightfuture.edu.gh
 * These are the accounts offered by the "Quick demo access" buttons on the login pages (GET /public/demo-accounts).
 */
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { DEFAULT_PLANS } from '../src/common/features';
import { SYSTEM_ROLES } from '../src/common/permissions';
import { DEFAULT_SETTINGS, defaultWebsiteConfig } from '../src/common/settings';

const { PrismaClient } = (
  process.env.PRISMA_ENGINE === 'wasm' ? require('@prisma/client/wasm') : require('@prisma/client')
) as typeof import('@prisma/client');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
const PASSWORD = 'Password123!';
const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', TRUE)`;

      // ── Platform ──
      await tx.platformUser.upsert({
        where: { email: 'admin@schoolos.app' },
        update: {},
        create: { email: 'admin@schoolos.app', name: 'Platform Owner', passwordHash: hash, role: 'SUPER_ADMIN' },
      });
      for (const p of DEFAULT_PLANS) await tx.plan.upsert({ where: { code: p.code }, update: {}, create: p });
      const pro = await tx.plan.findUnique({ where: { code: 'PROFESSIONAL' } });

      if (await tx.tenant.findUnique({ where: { slug: 'brightfuture' } })) {
        console.log('Demo school already exists — nothing to do.');
        return;
      }

      // ── School ──
      const now = new Date();
      const y = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
      const tenant = await tx.tenant.create({
        data: {
          code: 'SCH-GH-000001',
          slug: 'brightfuture',
          name: 'Bright Future Academy',
          type: 'BASIC',
          country: 'GH',
          region: 'Greater Accra',
          district: 'Accra Metropolitan',
          address: '12 Liberation Road, Accra',
          phone: '+233201234567',
          email: 'info@brightfuture.edu.gh',
          principalName: 'Mrs. Akosua Mensah',
          primaryColor: '#0f766e',
          secondaryColor: '#134e4a',
          status: 'ACTIVE',
          approvedAt: now,
          settings: {
            ...DEFAULT_SETTINGS,
            finance: { ...DEFAULT_SETTINGS.finance, defaultInstallments: 3 },
            // Demo school teaches Primary and JHS only (no KG classes seeded) and takes both day and boarding students.
            school: { ...DEFAULT_SETTINGS.school, levels: ['PRIMARY', 'JHS'], residency: 'DAY_AND_BOARDING' },
          } as any,
          websiteConfig: defaultWebsiteConfig('Bright Future Academy') as any,
          domains: {
            create: {
              domain: `brightfuture.${process.env.ROOT_DOMAIN || 'localhost'}`,
              type: 'SUBDOMAIN',
              isPrimary: true,
              verified: true,
              verifiedAt: now,
            },
          },
          subscription: {
            create: {
              planId: pro.id,
              status: 'ACTIVE',
              billingCycle: 'YEARLY',
              currentPeriodStart: now,
              currentPeriodEnd: new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate())),
            },
          },
        },
      });
      const T = tenant.id;
      await tx.sequence.upsert({
        where: { scope_key: { scope: 'PLATFORM', key: 'school' } },
        update: { value: 1 },
        create: { scope: 'PLATFORM', key: 'school', value: 1 },
      });
      const roles: Record<string, string> = {};
      for (const [name, r] of Object.entries(SYSTEM_ROLES)) {
        const role = await tx.role.create({
          data: { tenantId: T, name, description: r.description, isSystem: true, permissions: r.permissions },
        });
        roles[name] = role.id;
      }
      const user = (email: string, firstName: string, lastName: string, userType: any, role: string, phone?: string) =>
        tx.user.create({
          data: {
            tenantId: T,
            email,
            passwordHash: hash,
            firstName,
            lastName,
            userType,
            phone,
            roles: { create: [{ tenantId: T, roleId: roles[role] }] },
          },
        });
      await user('admin@brightfuture.edu.gh', 'Akosua', 'Mensah', 'STAFF', 'School Admin', '+233201234567');
      const teacherUser = await user(
        'teacher@brightfuture.edu.gh',
        'Kwame',
        'Boateng',
        'TEACHER',
        'Class Teacher',
        '+233241112233',
      );
      const teacher2User = await user(
        'teacher2@brightfuture.edu.gh',
        'Ama',
        'Owusu',
        'TEACHER',
        'Teacher',
        '+233241112244',
      );
      await user('accounts@brightfuture.edu.gh', 'Yaw', 'Asante', 'STAFF', 'Accountant', '+233241112255');
      await user('canteen@brightfuture.edu.gh', 'Efua', 'Darko', 'STAFF', 'Canteen Manager', '+233241112266');
      const parentUser = await user('parent@brightfuture.edu.gh', 'Kofi', 'Adjei', 'PARENT', 'Parent', '+233209876543');
      await user('proprietor@brightfuture.edu.gh', 'Kwabena', 'Owusu-Ansah', 'STAFF', 'Proprietor', '+233241112311');
      await user('headmaster@brightfuture.edu.gh', 'Nana', 'Ofori', 'STAFF', 'Headmaster', '+233241112277');
      const formMasterUser = await user(
        'formmaster@brightfuture.edu.gh',
        'Kwesi',
        'Ansah',
        'TEACHER',
        'Class Teacher',
        '+233241112322',
      );
      await user('nurse@brightfuture.edu.gh', 'Adjoa', 'Kumi', 'STAFF', 'Nurse', '+233241112288');
      await user('librarian@brightfuture.edu.gh', 'Kojo', 'Appiah', 'STAFF', 'Librarian', '+233241112299');
      await user('hr@brightfuture.edu.gh', 'Esi', 'Tetteh', 'STAFF', 'HR Officer', '+233241112300');
      const studentUser = await user('student@brightfuture.edu.gh', 'Abena', 'Mensah', 'STUDENT', 'Student');

      // ── Academic structure ──
      const year = await tx.academicYear.create({
        data: { tenantId: T, name: `${y}/${y + 1}`, startDate: d(y, 9, 1), endDate: d(y + 1, 7, 31), isCurrent: true },
      });
      const termDefs = [
        ['Term 1', d(y, 9, 1), d(y, 12, 15)],
        ['Term 2', d(y + 1, 1, 8), d(y + 1, 4, 10)],
        ['Term 3', d(y + 1, 4, 28), d(y + 1, 7, 31)],
      ] as const;
      let cur = termDefs.findIndex(([, s, e]) => now >= s && now <= e);
      if (cur === -1) cur = 0;
      const terms = [] as any[];
      for (let i = 0; i < termDefs.length; i++)
        terms.push(
          await tx.term.create({
            data: {
              tenantId: T,
              academicYearId: year.id,
              name: termDefs[i][0],
              sequence: i + 1,
              startDate: termDefs[i][1],
              endDate: termDefs[i][2],
              isCurrent: i === cur,
            },
          }),
        );
      const staff1 = await tx.staff.create({
        data: {
          tenantId: T,
          userId: teacherUser.id,
          employeeId: 'EMP-0001',
          firstName: 'Kwame',
          lastName: 'Boateng',
          gender: 'MALE',
          phone: '+233241112233',
          email: 'teacher@brightfuture.edu.gh',
          staffType: 'TEACHING',
          position: 'Class Teacher',
          employmentDate: d(2019, 9, 1),
        },
      });
      const staff2 = await tx.staff.create({
        data: {
          tenantId: T,
          userId: teacher2User.id,
          employeeId: 'EMP-0002',
          firstName: 'Ama',
          lastName: 'Owusu',
          gender: 'FEMALE',
          phone: '+233241112244',
          email: 'teacher2@brightfuture.edu.gh',
          staffType: 'TEACHING',
          position: 'Subject Teacher',
          employmentDate: d(2021, 1, 10),
        },
      });
      const staff3 = await tx.staff.create({
        data: {
          tenantId: T,
          userId: formMasterUser.id,
          employeeId: 'EMP-0003',
          firstName: 'Kwesi',
          lastName: 'Ansah',
          gender: 'MALE',
          phone: '+233241112322',
          email: 'formmaster@brightfuture.edu.gh',
          staffType: 'TEACHING',
          position: 'Form Master',
          employmentDate: d(2020, 9, 1),
        },
      });
      await tx.sequence.upsert({
        where: { scope_key: { scope: T, key: 'staff' } },
        update: { value: 3 },
        create: { scope: T, key: 'staff', value: 3 },
      });
      const subjectDefs = [
        ['English Language', 'ENG'],
        ['Mathematics', 'MATH'],
        ['Integrated Science', 'SCI'],
        ['Social Studies', 'SOC'],
        ['Religious & Moral Education', 'RME'],
        ['Computing', 'ICT'],
      ];
      const subjects = [] as any[];
      for (const [name, code] of subjectDefs)
        subjects.push(await tx.subject.create({ data: { tenantId: T, name, code } }));
      const classDefs = [
        ['Basic 5', 'PRIMARY'],
        ['Basic 6', 'PRIMARY'],
        ['JHS 1', 'JHS'],
        ['JHS 2', 'JHS'],
      ];
      const classes = [] as any[];
      for (const [i, [name, level]] of classDefs.entries()) {
        const c = await tx.schoolClass.create({
          data: {
            tenantId: T,
            name,
            level,
            capacity: 40,
            classTeacherId: i === 0 ? staff1.id : i === 1 ? staff2.id : i === 2 ? staff3.id : null,
          },
        });
        classes.push(c);
        for (const [j, s] of subjects.entries())
          await tx.classSubject.create({
            data: { tenantId: T, classId: c.id, subjectId: s.id, teacherId: j % 2 === 0 ? staff1.id : staff2.id },
          });
      }
      for (const [i, r] of [
        ['Room A', 40],
        ['Room B', 40],
        ['ICT Lab', 30],
      ].entries())
        await tx.room.create({ data: { tenantId: T, name: r[0] as string, capacity: r[1] as number } });
      const periodDefs = [
        ['Period 1', '07:30', '08:20'],
        ['Period 2', '08:20', '09:10'],
        ['Period 3', '09:10', '10:00'],
        ['Break', '10:00', '10:30', true],
        ['Period 4', '10:30', '11:20'],
        ['Period 5', '11:20', '12:10'],
        ['Lunch', '12:10', '13:00', true],
        ['Period 6', '13:00', '13:50'],
      ];
      for (const [i, p] of periodDefs.entries())
        await tx.period.create({
          data: {
            tenantId: T,
            name: p[0] as string,
            startTime: p[1] as string,
            endTime: p[2] as string,
            sequence: i + 1,
            isBreak: !!p[3],
          },
        });

      // ── Students & guardians ──
      const first = [
        'Abena',
        'Kojo',
        'Esi',
        'Yaw',
        'Adwoa',
        'Kwesi',
        'Akua',
        'Kwabena',
        'Afia',
        'Kwaku',
        'Ama',
        'Fiifi',
        'Araba',
        'Ekow',
        'Maame',
        'Nana',
        'Serwaa',
        'Kofi',
        'Efua',
        'Paa',
      ];
      const last = ['Mensah', 'Owusu', 'Asante', 'Boateng', 'Agyeman', 'Appiah', 'Darko', 'Osei', 'Amoah', 'Frimpong'];
      const guardian = await tx.guardian.create({
        data: {
          tenantId: T,
          userId: parentUser.id,
          firstName: 'Kofi',
          lastName: 'Adjei',
          phone: '+233209876543',
          email: 'parent@brightfuture.edu.gh',
          occupation: 'Engineer',
        },
      });
      let seq = 0;
      for (const [ci, c] of classes.entries()) {
        for (let i = 0; i < 8; i++) {
          seq++;
          const fn = first[(ci * 8 + i) % first.length],
            ln = last[(ci * 3 + i) % last.length];
          const s = await tx.student.create({
            data: {
              tenantId: T,
              studentId: `STD-${y}-${String(seq).padStart(6, '0')}`,
              firstName: fn,
              lastName: ln,
              gender: i % 2 ? 'FEMALE' : 'MALE',
              dateOfBirth: d(y - 10 - ci, 3 + i, 12),
              classId: c.id,
              admissionDate: d(y, 9, 1),
              isBoarding: i % 4 === 0,
              account: { create: { tenantId: T } },
            },
          });
          if (ci === 0 && i < 2)
            await tx.studentGuardian.create({
              data: { tenantId: T, studentId: s.id, guardianId: guardian.id, relationship: 'FATHER', isPrimary: true },
            });
          else {
            const g = await tx.guardian.create({
              data: {
                tenantId: T,
                firstName: `${ln} Sr.`,
                lastName: ln,
                phone: `+23324${String(1000000 + seq * 37).slice(0, 7)}`,
                email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`,
              },
            });
            await tx.studentGuardian.create({
              data: { tenantId: T, studentId: s.id, guardianId: g.id, relationship: 'PARENT', isPrimary: true },
            });
          }
        }
      }
      await tx.sequence.upsert({
        where: { scope_key: { scope: T, key: 'student' } },
        update: { value: seq },
        create: { scope: T, key: 'student', value: seq },
      });

      // ── Fees ──
      // A representative starting set of bill types a Ghanaian basic school actually charges;
      // Finance Officers can add, rename or deactivate any of these from Fees > Categories.
      const cats = {} as Record<string, string>;
      for (const n of [
        'Tuition',
        'Examination Fees',
        'Feeding Fee',
        'Bursary',
        'Classes/Part-time Fees',
        'Printing Fee',
        'PTA Dues',
        'ICT Levy',
        'Boarding',
      ])
        cats[n] = (await tx.feeCategory.create({ data: { tenantId: T, name: n } })).id;
      const fee = (level: string, cat: string, amount: number, appliesTo: any = 'ALL') =>
        tx.feeStructure.create({
          data: { tenantId: T, academicYearId: year.id, level, categoryId: cats[cat], amount, appliesTo },
        });
      await fee('PRIMARY', 'Tuition', 900);
      await fee('PRIMARY', 'Examination Fees', 30);
      await fee('PRIMARY', 'Feeding Fee', 15);
      await fee('PRIMARY', 'Classes/Part-time Fees', 20);
      await fee('PRIMARY', 'Printing Fee', 15);
      await fee('PRIMARY', 'PTA Dues', 50);
      await fee('PRIMARY', 'ICT Levy', 40);
      await fee('PRIMARY', 'Boarding', 1200, 'BOARDING');
      await fee('JHS', 'Tuition', 1200);
      await fee('JHS', 'Examination Fees', 50);
      await fee('JHS', 'Feeding Fee', 15);
      await fee('JHS', 'Classes/Part-time Fees', 25);
      await fee('JHS', 'Printing Fee', 20);
      await fee('JHS', 'PTA Dues', 60);
      await fee('JHS', 'ICT Levy', 60);
      await fee('JHS', 'Boarding', 1400, 'BOARDING');
      // Bursary is left with no default structure — schools set an amount only if they charge one; it
      // otherwise exists so a discretionary bursary/hardship credit can be recorded against it.

      // ── Canteen ──
      for (const [name, price, stock] of [
        ['Jollof rice', 12, 80],
        ['Waakye', 10, 60],
        ['Meat pie', 6, 100],
        ['Sachet water', 1, 500],
        ['Fruit juice', 5, 120],
      ])
        await tx.canteenItem.create({
          data: { tenantId: T, name: name as string, price: price as number, stock: stock as number, minStock: 20 },
        });
      await tx.inventoryItem.create({
        data: {
          tenantId: T,
          name: 'A4 paper (reams)',
          category: 'STATIONERY',
          quantity: 45,
          minQuantity: 10,
          unit: 'ream',
        },
      });
      await tx.inventoryItem.create({
        data: {
          tenantId: T,
          name: 'Whiteboard markers',
          category: 'STATIONERY',
          quantity: 8,
          minQuantity: 12,
          unit: 'box',
        },
      });

      await tx.announcement.create({
        data: {
          tenantId: T,
          title: 'Welcome to the new term',
          body: 'We are delighted to welcome all students back. PTA meeting holds on the first Friday of the term.',
          audienceType: 'ALL',
          channels: ['IN_APP'],
          isPublic: true,
          publishedAt: now,
        },
      });
      // ── Extended modules: discipline, events, assignments, library, transport, health, messaging, HR ──
      const allStudents = await tx.student.findMany({ where: { tenantId: T }, orderBy: { studentId: 'asc' } });
      const adminUser = await tx.user.findFirst({ where: { tenantId: T, email: 'admin@brightfuture.edu.gh' } });
      const p5 = classes[0],
        jhs1 = classes[2];
      const p5Students = allStudents.filter((st) => st.classId === p5.id);
      await tx.student.update({ where: { id: p5Students[0].id }, data: { userId: studentUser.id } });
      const dayAgo = (n: number) => new Date(now.getTime() - n * 86400000);

      // Discipline
      const incidents = [
        {
          studentId: p5Students[3].id,
          date: dayAgo(12),
          category: 'LATENESS',
          severity: 'MINOR',
          description: 'Arrived 25 minutes after assembly for the third time this month.',
          actionTaken: 'Verbal warning; parent informed.',
          points: 1,
          status: 'RESOLVED',
          parentNotified: true,
        },
        {
          studentId: p5Students[5].id,
          date: dayAgo(5),
          category: 'DISRUPTION',
          severity: 'MODERATE',
          description: 'Repeatedly talking during the mathematics lesson and refusing to settle.',
          actionTaken: 'Detention during break; apology letter.',
          points: 3,
          status: 'RESOLVED',
          parentNotified: false,
        },
        {
          studentId: allStudents[20].id,
          date: dayAgo(1),
          category: 'FIGHTING',
          severity: 'SERIOUS',
          description: 'Physical altercation on the playground after school.',
          actionTaken: null,
          points: 5,
          status: 'OPEN',
          parentNotified: true,
        },
      ];
      for (const inc of incidents)
        await tx.disciplineIncident.create({
          data: {
            tenantId: T,
            ...(inc as any),
            reportedById: teacherUser.id,
            resolvedById: inc.status === 'RESOLVED' ? adminUser?.id : null,
            resolvedAt: inc.status === 'RESOLVED' ? dayAgo(2) : null,
          },
        });

      // Events
      const events = [
        {
          title: 'PTA General Meeting',
          type: 'MEETING',
          startAt: dayAgo(-9),
          location: 'Assembly Hall',
          audienceType: 'PARENTS',
          description: 'Termly meeting of parents and teachers. Agenda: fees, results and the sports festival.',
        },
        {
          title: 'Inter-house Sports Festival',
          type: 'SPORTS',
          startAt: dayAgo(-21),
          location: 'School Field',
          audienceType: 'ALL',
          isPublic: true,
          allDay: true,
          description: 'Athletics, football and volleyball competitions between the four houses.',
        },
        {
          title: 'Mid-term Examinations',
          type: 'EXAM',
          startAt: dayAgo(-30),
          endAt: dayAgo(-34),
          audienceType: 'ALL',
          allDay: true,
        },
        {
          title: 'Independence Day (holiday)',
          type: 'HOLIDAY',
          startAt: new Date(Date.UTC(now.getUTCFullYear() + (now.getUTCMonth() > 2 ? 1 : 0), 2, 6)),
          audienceType: 'ALL',
          isPublic: true,
          allDay: true,
        },
        {
          title: 'Staff Development Workshop',
          type: 'MEETING',
          startAt: dayAgo(-4),
          location: 'ICT Lab',
          audienceType: 'STAFF',
          description: 'Using Nimdee offline attendance and results workflow.',
        },
        {
          title: 'Basic 5 Museum Trip',
          type: 'TRIP',
          startAt: dayAgo(-16),
          location: 'National Museum, Accra',
          audienceType: 'CLASS',
          classId: p5.id,
          description: 'Bring GHS 20 for lunch. Departure 8:00am.',
        },
      ];
      for (const e of events)
        await tx.schoolEvent.create({
          data: {
            tenantId: T,
            title: e.title,
            type: e.type as any,
            startAt: e.startAt,
            endAt: (e as any).endAt ?? new Date(e.startAt.getTime() + (e.allDay ? 86400000 - 1 : 7200000)),
            allDay: !!e.allDay,
            location: (e as any).location,
            audienceType: e.audienceType as any,
            classId: (e as any).classId ?? null,
            isPublic: !!(e as any).isPublic,
            description: (e as any).description,
            createdById: adminUser?.id,
          },
        });

      // Assignments (Basic 5 English & Maths)
      const eng = subjects.find((x: any) => x.code === 'ENG'),
        math = subjects.find((x: any) => x.code === 'MATH');
      const a1 = await tx.assignment.create({
        data: {
          tenantId: T,
          classId: p5.id,
          subjectId: eng.id,
          teacherId: staff1.id,
          title: 'Reading comprehension: "The Talking Drum"',
          instructions: 'Read pages 12–15 of the English reader and answer questions 1–8 in full sentences.',
          dueAt: dayAgo(-3),
          maxScore: 20,
          createdById: teacherUser.id,
        },
      });
      const a2 = await tx.assignment.create({
        data: {
          tenantId: T,
          classId: p5.id,
          subjectId: math.id,
          teacherId: staff2.id,
          title: 'Fractions worksheet 4',
          instructions: 'Complete all 25 questions on adding and subtracting fractions with unlike denominators.',
          dueAt: dayAgo(2),
          maxScore: 25,
          createdById: teacher2User.id,
        },
      });
      for (const [i, st] of p5Students.entries()) {
        await tx.assignmentSubmission.create({
          data: {
            tenantId: T,
            assignmentId: a1.id,
            studentId: st.id,
            status: i % 3 === 0 ? 'SUBMITTED' : 'PENDING',
            submittedAt: i % 3 === 0 ? dayAgo(1) : null,
          },
        });
        const graded = i % 4 !== 3;
        await tx.assignmentSubmission.create({
          data: {
            tenantId: T,
            assignmentId: a2.id,
            studentId: st.id,
            status: graded ? 'GRADED' : 'MISSING',
            submittedAt: graded ? dayAgo(3) : null,
            score: graded ? 14 + (i % 11) : null,
            feedback: graded ? (i % 2 ? 'Good work — watch your denominators.' : 'Excellent, keep it up!') : null,
            gradedById: teacher2User.id,
            gradedAt: graded ? dayAgo(1) : null,
          },
        });
      }

      // Library
      const bookDefs = [
        ['9780435905798', 'Things Fall Apart', 'Chinua Achebe', 'LITERATURE', 3],
        ['9789964701234', 'New Ghana Primary Mathematics 5', 'GES', 'TEXTBOOK', 12],
        ['9780194301222', 'Oxford Junior English', 'Oxford', 'TEXTBOOK', 10],
        ['9780007123995', 'The Lion, the Witch and the Wardrobe', 'C. S. Lewis', 'FICTION', 2],
        ['9789988000000', 'Ananse Stories', 'Peggy Appiah', 'FICTION', 4],
        ['9780198328971', 'Integrated Science for JHS', 'Aki-Ola', 'TEXTBOOK', 8],
        ['9780006479888', 'Atlas of Ghana', 'Collins', 'REFERENCE', 2],
      ];
      const books = [] as any[];
      for (const [isbn, title, author, category, copies] of bookDefs)
        books.push(
          await tx.libraryBook.create({
            data: {
              tenantId: T,
              isbn: isbn as string,
              title: title as string,
              author: author as string,
              category: category as string,
              copiesTotal: copies as number,
              copiesAvailable: copies as number,
              location: 'Main library',
            },
          }),
        );
      const loanDefs = [
        [0, p5Students[0].id, -20, -6, 'OVERDUE'],
        [3, p5Students[1].id, -10, 4, 'BORROWED'],
        [4, allStudents[10].id, -30, -16, 'RETURNED'],
        [1, allStudents[12].id, -3, 11, 'BORROWED'],
      ];
      for (const [bi, studentId, borrowedDays, dueDays, status] of loanDefs) {
        await tx.libraryLoan.create({
          data: {
            tenantId: T,
            bookId: books[bi as number].id,
            studentId: studentId as string,
            borrowedAt: dayAgo(-(borrowedDays as number)),
            dueAt: dayAgo(-(dueDays as number)),
            status: status as any,
            returnedAt: status === 'RETURNED' ? dayAgo(17) : null,
            fine: status === 'OVERDUE' ? 6 : 0,
            issuedById: adminUser?.id,
          },
        });
        if (status !== 'RETURNED')
          await tx.libraryBook.update({
            where: { id: books[bi as number].id },
            data: { copiesAvailable: { decrement: 1 } },
          });
      }

      // Transport
      const route1 = await tx.transportRoute.create({
        data: {
          tenantId: T,
          name: 'Route A — Madina / Adenta',
          vehicle: 'GR 4521-22 (Toyota Coaster)',
          driverName: 'Yaw Mensah',
          driverPhone: '+233244000111',
          capacity: 28,
          termFee: 450,
        },
      });
      const route2 = await tx.transportRoute.create({
        data: {
          tenantId: T,
          name: 'Route B — East Legon / Spintex',
          vehicle: 'GT 8890-21 (Hyundai County)',
          driverName: 'Kofi Antwi',
          driverPhone: '+233244000222',
          capacity: 24,
          termFee: 400,
        },
      });
      const stops1 = [] as any[];
      for (const [i, [name, pick, drop]] of [
        ['Madina Market', '06:20', '15:40'],
        ['Adenta Barrier', '06:35', '15:25'],
        ['Frafraha Junction', '06:50', '15:10'],
      ].entries())
        stops1.push(
          await tx.transportStop.create({
            data: { tenantId: T, routeId: route1.id, name, sequence: i + 1, pickupTime: pick, dropoffTime: drop },
          }),
        );
      for (const [i, [name, pick, drop]] of [
        ['American House', '06:30', '15:35'],
        ['Spintex Road (Coca-Cola)', '06:45', '15:20'],
      ].entries())
        await tx.transportStop.create({
          data: { tenantId: T, routeId: route2.id, name, sequence: i + 1, pickupTime: pick, dropoffTime: drop },
        });
      for (const [i, st] of allStudents.slice(0, 6).entries())
        await tx.transportAssignment.create({
          data: { tenantId: T, routeId: route1.id, stopId: stops1[i % 3].id, studentId: st.id, startDate: d(y, 9, 1) },
        });

      // Health
      await tx.healthRecord.create({
        data: {
          tenantId: T,
          studentId: p5Students[0].id,
          bloodGroup: 'O+',
          allergies: 'Peanuts (severe)',
          conditions: 'Asthma',
          medications: 'Salbutamol inhaler as needed',
          immunizations: [
            { name: 'BCG', date: '2015-04-01' },
            { name: 'Measles', date: '2016-01-15' },
          ],
          doctorName: 'Dr. Adjoa Kumi',
          doctorPhone: '+233302000333',
          insuranceProvider: 'NHIS',
          insuranceNumber: 'NH-3341-2210',
        },
      });
      await tx.healthVisit.create({
        data: {
          tenantId: T,
          studentId: p5Students[0].id,
          date: dayAgo(8),
          type: 'SICK_BAY',
          complaint: 'Wheezing after PE',
          treatment: 'Inhaler administered, rested 30 minutes',
          temperature: 36.9,
          parentNotified: true,
          recordedById: adminUser?.id,
        },
      });
      await tx.healthVisit.create({
        data: {
          tenantId: T,
          studentId: allStudents[15].id,
          date: dayAgo(1),
          type: 'INJURY',
          complaint: 'Grazed knee on the playground',
          treatment: 'Cleaned and dressed',
          temperature: 36.6,
          recordedById: adminUser?.id,
        },
      });
      await tx.healthVisit.create({
        data: {
          tenantId: T,
          studentId: allStudents[17].id,
          date: now,
          type: 'SICK_BAY',
          complaint: 'Headache and mild fever',
          treatment: 'Paracetamol, parent called to collect',
          temperature: 38.2,
          parentNotified: true,
          referredOut: false,
          recordedById: adminUser?.id,
        },
      });

      // Messaging: parent ↔ class teacher
      const thread = await tx.messageThread.create({
        data: { tenantId: T, type: 'DIRECT', createdById: parentUser.id, lastMessageAt: dayAgo(0) },
      });
      await tx.messageParticipant.createMany({
        data: [
          { tenantId: T, threadId: thread.id, userId: parentUser.id, lastReadAt: now },
          { tenantId: T, threadId: thread.id, userId: teacherUser.id },
        ],
      });
      await tx.message.create({
        data: {
          tenantId: T,
          threadId: thread.id,
          senderId: parentUser.id,
          body: 'Good afternoon Mr Boateng, Abena will miss school on Friday for a hospital appointment. Could you share the homework in advance?',
          createdAt: dayAgo(1),
        },
      });
      await tx.message.create({
        data: {
          tenantId: T,
          threadId: thread.id,
          senderId: teacherUser.id,
          body: 'Noted, thank you. The English comprehension is already on the portal; I will add the maths worksheet tomorrow.',
          createdAt: dayAgo(0),
        },
      });

      // HR: leave + payroll
      await tx.staff.update({ where: { id: staff1.id }, data: { basicSalary: 2800 } });
      await tx.staff.update({ where: { id: staff2.id }, data: { basicSalary: 2400 } });
      await tx.leaveRequest.create({
        data: {
          tenantId: T,
          staffId: staff2.id,
          type: 'SICK',
          startDate: dayAgo(9),
          endDate: dayAgo(7),
          days: 3,
          reason: 'Malaria treatment',
          status: 'APPROVED',
          reviewedById: adminUser?.id,
          reviewedAt: dayAgo(9),
          reviewNote: 'Get well soon.',
        },
      });
      await tx.leaveRequest.create({
        data: {
          tenantId: T,
          staffId: staff1.id,
          type: 'STUDY',
          startDate: dayAgo(-20),
          endDate: dayAgo(-24),
          days: 5,
          reason: 'University examinations',
          status: 'PENDING',
        },
      });
      const period = `${now.getUTCFullYear()}-${String(now.getUTCMonth() === 0 ? 12 : now.getUTCMonth()).padStart(2, '0')}`;
      const run = await tx.payrollRun.create({
        data: {
          tenantId: T,
          period,
          status: 'PAID',
          totalGross: 5400,
          totalDeductions: 594,
          totalNet: 4806,
          staffCount: 2,
          approvedById: adminUser?.id,
          approvedAt: dayAgo(12),
          paidAt: dayAgo(10),
          createdById: adminUser?.id,
        },
      });
      await tx.payrollItem.create({
        data: {
          tenantId: T,
          runId: run.id,
          staffId: staff1.id,
          basic: 2800,
          allowances: 200,
          deductions: 330,
          net: 2670,
          notes: 'SSNIT 5.5%, transport allowance',
        },
      });
      await tx.payrollItem.create({
        data: {
          tenantId: T,
          runId: run.id,
          staffId: staff2.id,
          basic: 2400,
          allowances: 0,
          deductions: 264,
          net: 2136,
          notes: 'SSNIT 5.5%',
        },
      });

      console.log(
        `Seeded demo school ${tenant.name} (${tenant.code}) with ${seq} students. Password for every demo login: ${PASSWORD}`,
      );
    },
    { timeout: 120_000 },
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
