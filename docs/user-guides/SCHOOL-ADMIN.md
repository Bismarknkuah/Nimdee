# School administrator guide

Log in at `https://<your-school>.yourdomain.com/login` (or the platform root and pick your school). Your dashboard shows the whole school: attendance today, fees collected and outstanding, staff on leave, results status, open incidents, overdue library books, sync conflicts and a **Needs attention** list that links to the right screen.

## First-week setup checklist

1. **Settings → Profile & Branding** — logo, colours and font are applied to the portal, website, ID cards, receipts and report cards.
2. **Settings → Rules engine → School levels & residency** — confirm which levels you run (KG / Primary / JHS) and whether you're a day school, boarding school, or both. This was set when you registered but can be changed here at any time.
3. **Academics** — if you haven't already, click **Set up standard classes & subjects** to create the standard KG 1–JHS 3 classes and the GES standards-based subjects for your levels in one step (safe to run again later — it only adds what's missing). Then confirm the academic year and terms (mark the current one), assign class teachers and capacities, and assign subject teachers per class; add rooms and timetable periods.
4. **Settings → Rules engine** — grading bands (letter grades A–F for KG/Primary, the BECE 1–9 scale for JHS, each editable separately), class/exam weights (must total 100), pass and promotion marks, result approval chain (review and/or approve before publishing), attendance minimum, invoice/receipt prefixes, installments, sibling discount, grace days, offline conflict policy, canteen daily limit, SMS sender ID, Paystack key.
5. **Staff** — add teachers and staff; tick *Create a portal login* to give them access with a role (Teacher, Class Teacher, Accountant, Cashier, Canteen Manager, Nurse, Librarian, HR Officer, Principal…). Temporary passwords are shown once.
6. **Students** — enrol students (auto IDs) with guardians; create parent logins from Parents & guardians. If you're a day-and-boarding school, choose each student's residency at enrolment — day-only or boarding-only schools set this automatically. Bulk moves between classes are on the class page.
7. **Fees → Categories & structures** — define fees per level or class (day vs boarding, per term or every term), then **Generate invoices** for the term.
8. **Website builder** — sections, admissions text, publish. The public site is live at your school address; admissions arrive under Admissions.
9. **Users & roles** — review roles; create custom roles from the permission catalogue.

## Daily operations

* **Attendance → Daily overview** shows which classes are unmarked; the dashboard warns you too.
* **Admissions** — review applications, schedule interviews, and admit straight into a class (creates the student and guardian).
* **Announcements** — target everyone, parents, staff, students or one class; send in-app, SMS and/or email; optionally publish on the website.
* **Calendar & events** — holidays, exams, PTA meetings, trips; audiences receive notifications.
* **Messages** — talk to any parent, teacher or staff member; start a whole-class thread.
* **Discipline** — log incidents with severity and demerit points; resolve or escalate; see trends by week, category and class.
* **Clinic**, **Library**, **Transport**, **HR & payroll** — each module has its own page with summaries and quick actions.
* **Results** — after teachers submit, review/approve/publish per class; download all report cards as one PDF.
* **Reports & analytics** — enrolment, attendance by class and week, chronic absentees, fee ageing and defaulters, subject/class performance, staff workload.

## Data & backup

Settings → **Data & backup** lets you download your whole database (JSON, CSV, SQL or all three in one ZIP). Downloads are recorded with who requested them. Use it monthly and before any migration.

## Offline devices

Sync shows every device that has marked attendance offline, what is still pending, and any conflicts waiting for a decision. Disable lost devices there.

## Subscription

Settings → Subscription shows your plan, student usage, trial/period end and invoices. Request a plan change; the platform confirms your payment and the new modules switch on immediately.
