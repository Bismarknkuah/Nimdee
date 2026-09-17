import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TenantCacheService } from '../tenants/tenant-cache.service';
import { AttendanceService } from '../attendance/attendance.service';
import { StudentsService } from '../students/students.service';
import { ctx, hasPermission, tid } from '../common/context/request-context';
import { addDays, startOfToday, toDateOnly, toJson } from '../common/utils';
import { HeartbeatDto, PushDto, RegisterDeviceDto, ResolveConflictDto, SyncOpDto } from './dto';

const STUDENT_SYNC_FIELDS = [
  'firstName',
  'lastName',
  'otherNames',
  'gender',
  'dateOfBirth',
  'house',
  'address',
  'emergencyContactName',
  'emergencyContactPhone',
  'medicalNotes',
  'photoUrl',
];
const OFFLINE_THRESHOLD_MS = 15 * 60_000;

/**
 * Offline-first sync engine.
 *  - Every client operation carries a client-generated operationId → exactly-once application (idempotent retries).
 *  - Each operation is applied in its own transaction together with its SyncOperation record, so a crash can
 *    never leave a half-applied operation.
 *  - Conflicts follow the school's policy (LATEST_WINS / SERVER_WINS / MANUAL) from the rules engine.
 */
@Injectable()
export class SyncService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private tenants: TenantCacheService,
    private attendance: AttendanceService,
    private students: StudentsService,
  ) {}

  async registerDevice(dto: RegisterDeviceDto) {
    const d = await this.prisma.db.device.create({
      data: { tenantId: tid(), userId: ctx().userId, name: dto.name.trim(), platform: dto.platform ?? 'WEB' },
    });
    await this.audit.log({
      action: 'DEVICE_REGISTERED',
      entity: 'Device',
      entityId: d.id,
      after: { name: d.name, platform: d.platform },
    });
    return d;
  }

  async heartbeat(dto: HeartbeatDto) {
    const d = await this.prisma.db.device.findFirst({ where: { id: dto.deviceId, userId: ctx().userId } });
    if (!d) throw new NotFoundException('Device not registered');
    await this.prisma.db.device.update({
      where: { id: d.id },
      data: { lastSeenAt: new Date(), pendingCount: dto.pendingCount ?? d.pendingCount },
    });
    return { serverTime: new Date().toISOString() };
  }

  async push(dto: PushDto) {
    const tenantId = tid();
    const device = await this.prisma.db.device.findFirst({
      where: { id: dto.deviceId, userId: ctx().userId, isActive: true },
    });
    if (!device) throw new NotFoundException('Device not registered or disabled. Register the device first.');
    const settings = await this.tenants.settings(tenantId);
    const results: any[] = [];
    for (const op of dto.operations) {
      const clientTs = new Date(op.clientTimestamp);
      try {
        const r = await this.prisma.tenantTx(async (tx) => {
          const row = await tx.syncOperation.create({
            data: {
              tenantId,
              deviceId: device.id,
              operationId: op.operationId,
              entity: op.entity,
              action: op.action,
              payload: op.payload ?? {},
              clientTimestamp: clientTs,
              status: 'APPLIED',
            },
          });
          const applied = await this.apply(tx, op, device.id, clientTs, settings.sync.conflictPolicy);
          await tx.syncOperation.update({
            where: { id: row.id },
            data: { status: applied.status, result: toJson(applied.result) },
          });
          return applied;
        });
        results.push({ operationId: op.operationId, ...r });
      } catch (e: any) {
        if (e?.code === 'P2002') {
          const existing = await this.prisma.db.syncOperation.findUnique({
            where: { tenantId_operationId: { tenantId, operationId: op.operationId } },
          });
          results.push({ operationId: op.operationId, status: 'DUPLICATE', result: existing?.result ?? null });
          continue;
        }
        const message = e?.response?.message ?? e?.message ?? 'Unknown error';
        await this.prisma.db.syncOperation
          .create({
            data: {
              tenantId,
              deviceId: device.id,
              operationId: op.operationId,
              entity: op.entity,
              action: op.action,
              payload: op.payload ?? {},
              clientTimestamp: clientTs,
              status: 'FAILED',
              error: String(message).slice(0, 500),
            },
          })
          .catch(() => undefined);
        results.push({ operationId: op.operationId, status: 'FAILED', error: String(message) });
      }
    }
    await this.prisma.db.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date(), lastSyncAt: new Date(), pendingCount: dto.pendingCount ?? 0 },
    });
    return { serverTime: new Date().toISOString(), results };
  }

  private async apply(
    tx: Tx,
    op: SyncOpDto,
    deviceId: string,
    clientTs: Date,
    policy: 'LATEST_WINS' | 'SERVER_WINS' | 'MANUAL',
  ): Promise<{ status: 'APPLIED' | 'CONFLICT'; result: any }> {
    const p = op.payload ?? {};
    if (op.entity === 'attendance' && op.action === 'mark') {
      if (!p.classId || !p.date || !Array.isArray(p.records))
        throw new BadRequestException('attendance.mark needs classId, date and records');
      await this.students.assertClassAccess(p.classId);
      const r = await this.attendance.applyMarks(tx, p.classId, p.date, p.records, {
        source: 'OFFLINE',
        deviceId,
        clientTimestamp: clientTs,
        policy,
        operationId: op.operationId,
      });
      return { status: r.conflicts > 0 ? 'CONFLICT' : 'APPLIED', result: r };
    }
    if (op.entity === 'student' && op.action === 'update') {
      if (!p.id || typeof p.changes !== 'object')
        throw new BadRequestException('student.update needs id, baseVersion and changes');
      const c = ctx();
      if (!hasPermission(c.permissions, 'STUDENT_EDIT'))
        throw new ForbiddenException('Missing permission: STUDENT_EDIT');
      const current = await tx.student.findUnique({ where: { id: p.id } });
      if (!current) throw new NotFoundException('Student not found');
      const changes: any = {};
      for (const k of STUDENT_SYNC_FIELDS)
        if (p.changes[k] !== undefined) changes[k] = k === 'dateOfBirth' ? toDateOnly(p.changes[k]) : p.changes[k];
      if (!Object.keys(changes).length) return { status: 'APPLIED', result: { skipped: true, reason: 'NO_CHANGES' } };
      const stale = typeof p.baseVersion === 'number' && p.baseVersion !== current.version;
      if (stale) {
        const clientNewer = clientTs > current.updatedAt;
        if (policy === 'MANUAL' || policy === 'SERVER_WINS' || (policy === 'LATEST_WINS' && !clientNewer)) {
          const conflict = await tx.syncConflict.create({
            data: {
              tenantId: tid(),
              entity: 'student',
              entityId: current.id,
              deviceId,
              operationId: op.operationId,
              serverValue: toJson(pick(current, Object.keys(changes))),
              clientValue: toJson(p.changes),
              status: policy === 'MANUAL' ? 'OPEN' : 'RESOLVED',
              resolution: policy === 'MANUAL' ? null : 'SERVER_AUTO',
              resolvedAt: policy === 'MANUAL' ? null : new Date(),
            },
          });
          return { status: 'CONFLICT', result: { conflictId: conflict.id, policy, serverVersion: current.version } };
        }
      }
      const updated = await tx.student.update({ where: { id: p.id }, data: { ...changes, version: { increment: 1 } } });
      return { status: 'APPLIED', result: { version: updated.version } };
    }
    throw new BadRequestException(`Unsupported operation ${op.entity}.${op.action}`);
  }

  /** Data a device needs to work offline: its classes, students and recent attendance (delta when `since` is given). */
  async pull(since?: string, classIdsCsv?: string) {
    const c = ctx();
    const db = this.prisma.db;
    const settings = await this.tenants.settings(tid());
    const restricted = c.userType === 'TEACHER' && !hasPermission(c.permissions, 'ACADEMIC_MANAGE');
    const where: any = {};
    if (restricted)
      where.OR = [{ classTeacherId: c.staffId ?? '-' }, { subjects: { some: { teacherId: c.staffId ?? '-' } } }];
    if (classIdsCsv) where.id = { in: classIdsCsv.split(',').filter(Boolean) };
    const classes = await db.schoolClass.findMany({
      where,
      select: { id: true, name: true, level: true, updatedAt: true },
    });
    const classIds = classes.map((k) => k.id);
    const sinceDate = since ? new Date(since) : undefined;
    const [students, attendance] = await Promise.all([
      db.student.findMany({
        where: { classId: { in: classIds }, status: 'ACTIVE', ...(sinceDate ? { updatedAt: { gt: sinceDate } } : {}) },
        select: {
          id: true,
          studentId: true,
          firstName: true,
          lastName: true,
          otherNames: true,
          gender: true,
          classId: true,
          photoUrl: true,
          version: true,
          updatedAt: true,
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      db.attendance.findMany({
        where: {
          classId: { in: classIds },
          date: { gte: addDays(startOfToday(), -settings.sync.attendanceWindowDays) },
          ...(sinceDate ? { updatedAt: { gt: sinceDate } } : {}),
        },
        select: { id: true, studentId: true, classId: true, date: true, status: true, note: true, updatedAt: true },
      }),
    ]);
    return {
      serverTime: new Date().toISOString(),
      full: !sinceDate,
      classes,
      students,
      attendance,
      settings: { attendanceStatuses: settings.attendance.statuses, conflictPolicy: settings.sync.conflictPolicy },
    };
  }

  async devices() {
    const db = this.prisma.db;
    const [devices, failed, conflicts] = await Promise.all([
      db.device.findMany({ orderBy: { lastSeenAt: 'desc' } }),
      db.syncOperation.groupBy({
        by: ['deviceId'],
        where: { status: 'FAILED', createdAt: { gte: addDays(new Date(), -7) } },
        _count: { _all: true },
      }),
      db.syncConflict.count({ where: { status: 'OPEN' } }),
    ]);
    const users = await db.user.findMany({
      where: { id: { in: [...new Set(devices.map((d) => d.userId))] } },
      select: { id: true, firstName: true, lastName: true, userType: true },
    });
    const now = Date.now();
    const items = devices.map((d) => {
      const u = users.find((x) => x.id === d.userId);
      const offline = now - d.lastSeenAt.getTime() > OFFLINE_THRESHOLD_MS;
      const status = !d.isActive ? 'DISABLED' : offline ? 'OFFLINE' : d.pendingCount > 0 ? 'PENDING' : 'SYNCED';
      return {
        ...d,
        user: u ? { name: `${u.firstName} ${u.lastName}`, userType: u.userType } : null,
        failed7d: failed.find((f) => f.deviceId === d.id)?._count._all ?? 0,
        status,
      };
    });
    return {
      summary: {
        devices: items.length,
        online: items.filter((i) => i.status !== 'OFFLINE' && i.status !== 'DISABLED').length,
        offline: items.filter((i) => i.status === 'OFFLINE').length,
        pendingOperations: items.reduce((a, i) => a + i.pendingCount, 0),
        failed7d: items.reduce((a, i) => a + i.failed7d, 0),
        openConflicts: conflicts,
      },
      items,
    };
  }

  async setDeviceActive(id: string, isActive: boolean) {
    const d = await this.prisma.db.device.update({ where: { id }, data: { isActive } });
    await this.audit.log({ action: isActive ? 'DEVICE_ENABLED' : 'DEVICE_DISABLED', entity: 'Device', entityId: id });
    return d;
  }

  operations(deviceId?: string, status?: string) {
    return this.prisma.db.syncOperation.findMany({
      where: { deviceId: deviceId || undefined, status: (status as any) || undefined },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        deviceId: true,
        operationId: true,
        entity: true,
        action: true,
        status: true,
        error: true,
        result: true,
        clientTimestamp: true,
        createdAt: true,
      },
    });
  }

  conflicts(status = 'OPEN') {
    return this.prisma.db.syncConflict.findMany({
      where: { status: status as any },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async resolveConflict(id: string, dto: ResolveConflictDto) {
    const conflict = await this.prisma.db.syncConflict.findUnique({ where: { id } });
    if (!conflict) throw new NotFoundException('Conflict not found');
    if (conflict.status === 'RESOLVED') throw new BadRequestException('Conflict already resolved');
    await this.prisma.tenantTx(async (tx) => {
      if (dto.resolution === 'CLIENT') {
        const cv: any = conflict.clientValue;
        if (conflict.entity === 'attendance') {
          await tx.attendance.update({
            where: { id: conflict.entityId },
            data: { status: cv.status, note: cv.note ?? null, source: 'OFFLINE', deviceId: conflict.deviceId },
          });
        } else if (conflict.entity === 'student') {
          const changes: any = {};
          for (const k of STUDENT_SYNC_FIELDS)
            if (cv[k] !== undefined) changes[k] = k === 'dateOfBirth' ? toDateOnly(cv[k]) : cv[k];
          await tx.student.update({
            where: { id: conflict.entityId },
            data: { ...changes, version: { increment: 1 } },
          });
        }
      }
      await tx.syncConflict.update({
        where: { id },
        data: { status: 'RESOLVED', resolution: dto.resolution, resolvedById: ctx().userId, resolvedAt: new Date() },
      });
    });
    await this.audit.log({
      action: 'SYNC_CONFLICT_RESOLVED',
      entity: conflict.entity,
      entityId: conflict.entityId,
      after: { conflictId: id, resolution: dto.resolution },
    });
    return { ok: true };
  }
}

function pick(obj: any, keys: string[]) {
  const out: any = {};
  for (const k of keys) out[k] = obj?.[k];
  return out;
}
