-- Attendance for one specific lesson (a timetable slot on a given date), separate from the existing
-- daily homeroom Attendance table. Whichever teacher is scheduled to teach that period marks it —
-- this is what "did the student attend the 10am Maths lesson" actually is, distinct from "was the
-- student in school today" (still tracked by the original Attendance table, unchanged).
CREATE TABLE "LessonAttendance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "timetableSlotId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonAttendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LessonAttendance_tenantId_studentId_timetableSlotId_date_key" ON "LessonAttendance"("tenantId", "studentId", "timetableSlotId", "date");
CREATE INDEX "LessonAttendance_tenantId_timetableSlotId_date_idx" ON "LessonAttendance"("tenantId", "timetableSlotId", "date");

ALTER TABLE "LessonAttendance" ADD CONSTRAINT "LessonAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonAttendance" ADD CONSTRAINT "LessonAttendance_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "TimetableSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
