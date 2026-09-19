-- Headmaster oversees attendance (views analytics/reports) but does not mark it — that stays with
-- the form/class teacher and whichever teacher is taking a given lesson, per the same separation of
-- duties already applied elsewhere (expenses, results approval, etc). Retroactive for schools whose
-- Headmaster role was already seeded before this change.
UPDATE "Role" SET permissions = array_remove(permissions, 'ATTENDANCE_MARK')
WHERE "isSystem" = true AND name = 'Headmaster';
