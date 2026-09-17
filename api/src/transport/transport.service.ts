import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { tid } from '../common/context/request-context';
import { money, toDateOnly } from '../common/utils';
import { AssignDto, RouteDto, StopDto } from './dto';

/** School transport: routes, stops, vehicles/drivers and student assignments with capacity checks. */
@Injectable()
export class TransportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async routes() {
    const routes = await this.prisma.db.transportRoute.findMany({
      orderBy: { name: 'asc' },
      include: {
        stops: { orderBy: { sequence: 'asc' } },
        _count: { select: { assignments: { where: { isActive: true } } } },
      },
    });
    return routes.map((r) => ({
      ...r,
      riders: r._count.assignments,
      _count: undefined,
      occupancy: r.capacity ? Math.round((r._count.assignments / r.capacity) * 100) : null,
    }));
  }

  async route(id: string) {
    const r = await this.prisma.db.transportRoute.findUnique({
      where: { id },
      include: {
        stops: { orderBy: { sequence: 'asc' } },
        assignments: {
          where: { isActive: true },
          include: {
            student: {
              select: {
                id: true,
                studentId: true,
                firstName: true,
                lastName: true,
                class: { select: { name: true } },
                guardians: {
                  where: { isPrimary: true },
                  include: { guardian: { select: { phone: true, firstName: true, lastName: true } } },
                },
              },
            },
            stop: { select: { id: true, name: true } },
          },
          orderBy: { student: { lastName: 'asc' } },
        },
      },
    });
    if (!r) throw new NotFoundException('Route not found');
    return {
      ...r,
      riders: r.assignments.length,
      occupancy: r.capacity ? Math.round((r.assignments.length / r.capacity) * 100) : null,
    };
  }

  async createRoute(dto: RouteDto) {
    const r = await this.prisma.db.transportRoute.create({
      data: {
        tenantId: tid(),
        name: dto.name.trim(),
        description: dto.description,
        vehicle: dto.vehicle,
        driverName: dto.driverName,
        driverPhone: dto.driverPhone,
        capacity: dto.capacity,
        termFee: dto.termFee !== undefined ? money(dto.termFee) : null,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.log({ action: 'TRANSPORT_ROUTE_CREATED', entity: 'TransportRoute', entityId: r.id, after: dto });
    return r;
  }

  async updateRoute(id: string, dto: Partial<RouteDto>) {
    const r = await this.prisma.db.transportRoute.update({
      where: { id },
      data: { ...dto, name: dto.name?.trim(), termFee: dto.termFee !== undefined ? money(dto.termFee) : undefined },
    });
    await this.audit.log({ action: 'TRANSPORT_ROUTE_UPDATED', entity: 'TransportRoute', entityId: id, after: dto });
    return r;
  }

  async deleteRoute(id: string) {
    const riders = await this.prisma.db.transportAssignment.count({ where: { routeId: id, isActive: true } });
    if (riders) throw new BadRequestException(`${riders} students are assigned to this route`);
    await this.prisma.db.transportRoute.delete({ where: { id } });
    await this.audit.log({ action: 'TRANSPORT_ROUTE_DELETED', entity: 'TransportRoute', entityId: id });
    return { ok: true };
  }

  async addStop(routeId: string, dto: StopDto) {
    const count = await this.prisma.db.transportStop.count({ where: { routeId } });
    return this.prisma.db.transportStop.create({
      data: {
        tenantId: tid(),
        routeId,
        name: dto.name.trim(),
        sequence: dto.sequence ?? count + 1,
        pickupTime: dto.pickupTime,
        dropoffTime: dto.dropoffTime,
      },
    });
  }

  updateStop(id: string, dto: Partial<StopDto>) {
    return this.prisma.db.transportStop.update({ where: { id }, data: { ...dto, name: dto.name?.trim() } });
  }

  async deleteStop(id: string) {
    await this.prisma.db.transportStop.delete({ where: { id } });
    return { ok: true };
  }

  async assign(dto: AssignDto) {
    const route = await this.prisma.db.transportRoute.findUnique({
      where: { id: dto.routeId },
      include: { _count: { select: { assignments: { where: { isActive: true } } } } },
    });
    if (!route) throw new NotFoundException('Route not found');
    if (route.capacity && route._count.assignments >= route.capacity)
      throw new BadRequestException(`Route ${route.name} is full (${route.capacity} seats)`);
    const a = await this.prisma.db.transportAssignment.upsert({
      where: { studentId: dto.studentId },
      create: {
        tenantId: tid(),
        studentId: dto.studentId,
        routeId: dto.routeId,
        stopId: dto.stopId ?? null,
        startDate: dto.startDate ? toDateOnly(dto.startDate) : new Date(),
        isActive: true,
      },
      update: {
        routeId: dto.routeId,
        stopId: dto.stopId ?? null,
        startDate: dto.startDate ? toDateOnly(dto.startDate) : undefined,
        endDate: null,
        isActive: true,
      },
    });
    await this.audit.log({
      action: 'TRANSPORT_STUDENT_ASSIGNED',
      entity: 'Student',
      entityId: dto.studentId,
      after: { routeId: dto.routeId, stopId: dto.stopId },
    });
    return a;
  }

  async unassign(studentId: string) {
    const a = await this.prisma.db.transportAssignment.findUnique({ where: { studentId } });
    if (!a) throw new NotFoundException('Student is not on a route');
    await this.prisma.db.transportAssignment.update({
      where: { studentId },
      data: { isActive: false, endDate: new Date() },
    });
    await this.audit.log({
      action: 'TRANSPORT_STUDENT_REMOVED',
      entity: 'Student',
      entityId: studentId,
      before: { routeId: a.routeId },
    });
    return { ok: true };
  }

  forStudent(studentId: string) {
    return this.prisma.db.transportAssignment.findUnique({
      where: { studentId },
      include: { route: { include: { stops: { orderBy: { sequence: 'asc' } } } }, stop: true },
    });
  }

  async summary() {
    const routes = await this.routes();
    return {
      routes: routes.length,
      activeRoutes: routes.filter((r) => r.isActive).length,
      riders: routes.reduce((a, r) => a + r.riders, 0),
      seats: routes.reduce((a, r) => a + (r.capacity ?? 0), 0),
    };
  }
}
