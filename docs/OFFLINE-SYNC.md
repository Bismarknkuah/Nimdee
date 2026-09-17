# Offline attendance & sync engine

Many schools have unreliable connectivity. Attendance is therefore offline-first.

## On the device (web/lib/offline.ts)

1. **Download for offline** on the attendance page calls `GET /sync/snapshot` and stores classes, students and the last N days of attendance in IndexedDB (`schoolos` database, `cache` store).
2. Marking attendance while offline (or when the request fails with a network error) enqueues an operation `{ opId (uuid), entity: 'attendance', action: 'mark', payload, clientTimestamp, attempts }` in the `ops` store and shows an "saved offline" toast.
3. `syncNow()` runs on `online` events, every 90 seconds and from the header pill. It registers the device once (`POST /sync/devices/register`, remembered in localStorage), then pushes pending ops in batches to `POST /sync/push`. Results are applied per op: `APPLIED` → removed, `DUPLICATE` → removed, `CONFLICT` → kept with status, `FAILED` → attempts++ (dropped after 8).
4. Heartbeats (`POST /sync/devices/heartbeat`) carry the pending count so administrators can see which devices still hold unsynced data.

## On the server (api/src/sync)

* `SyncOperation` rows make pushes idempotent: an `opId` already applied returns `DUPLICATE` instead of being re-run.
* Attendance records carry `version` and `updatedAt`. When an op targets a record that changed on the server after `clientTimestamp`, the school's rule decides:
  * `LATEST_WINS` — newer timestamp wins;
  * `SERVER_WINS` — server value kept, device informed;
  * `MANUAL` — a `SyncConflict` is opened for an administrator (Sync → Conflicts) who chooses a side.
* Devices can be disabled (Sync → Devices); disabled devices are refused on push.
* `GET /sync/operations` gives the operation log; the platform console aggregates pending ops, offline devices and conflicts per school.

## Limits

* The offline queue covers attendance marking. Student edits offline are allowed only when the rule `sync.allowOfflineStudentEdits` is on.
* The canteen POS and fee collection require connectivity (money is never queued offline).
