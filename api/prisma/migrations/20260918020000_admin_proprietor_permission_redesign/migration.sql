-- Redesigns School Admin and Proprietor into pure management/oversight roles with no day-to-day
-- data entry, retroactively applied to every school's existing seeded roles (a code-only change to
-- SYSTEM_ROLES would only affect newly registered schools, not rows already written to this table).
-- Headmaster and every operational role (Teacher, Accountant, Canteen Manager, HR Officer, ...) are
-- untouched: they keep doing the hands-on work; School Admin configures the school; Proprietor
-- oversees every activity through reports, audit log and billing only.
UPDATE "Role"
SET permissions = ARRAY[
  'SCHOOL_MANAGE','SETTINGS_MANAGE','WEBSITE_MANAGE','USERS_MANAGE','ROLES_MANAGE','AUDIT_VIEW',
  'SUBSCRIPTION_MANAGE','SYNC_MANAGE','ACADEMIC_MANAGE','TIMETABLE_VIEW','STUDENT_VIEW','STAFF_VIEW',
  'ATTENDANCE_VIEW','RESULT_VIEW','FEES_VIEW','FEES_MANAGE','CANTEEN_VIEW','CANTEEN_MANAGE',
  'INVENTORY_VIEW','ANNOUNCEMENT_MANAGE','MESSAGES_SEND','DISCIPLINE_VIEW','EVENTS_MANAGE',
  'ASSIGNMENTS_VIEW','LIBRARY_VIEW','TRANSPORT_VIEW','HEALTH_VIEW','LEAVE_REQUEST','REPORTS_VIEW',
  'EXPORT_DATA','BACKUP_DOWNLOAD','ADMISSIONS_VIEW'
]::TEXT[]
WHERE name = 'School Admin' AND "isSystem" = true;

UPDATE "Role"
SET permissions = ARRAY[
  'STUDENT_VIEW','STAFF_VIEW','ATTENDANCE_VIEW','RESULT_VIEW','FEES_VIEW','CANTEEN_VIEW',
  'INVENTORY_VIEW','DISCIPLINE_VIEW','ASSIGNMENTS_VIEW','LIBRARY_VIEW','TRANSPORT_VIEW','HEALTH_VIEW',
  'TIMETABLE_VIEW','AUDIT_VIEW','REPORTS_VIEW','EXPORT_DATA','SUBSCRIPTION_MANAGE','ADMISSIONS_VIEW'
]::TEXT[]
WHERE name = 'Proprietor' AND "isSystem" = true;
