import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ctx, tid } from '../common/context/request-context';
import { money } from '../common/utils';
import { InventoryItemDto, InventoryMoveDto } from './dto';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  items(search?: string) {
    return this.prisma.db.inventoryItem.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }
  lowStock() {
    return this.prisma.db.inventoryItem.findMany({
      where: { quantity: { lte: this.prisma.inventoryItem.fields.minQuantity } },
      orderBy: { quantity: 'asc' },
    });
  }
  async create(dto: InventoryItemDto) {
    const item = await this.prisma.tenantTx(async (tx) => {
      const it = await tx.inventoryItem.create({
        data: {
          tenantId: tid(),
          name: dto.name.trim(),
          category: dto.category ?? 'GENERAL',
          quantity: dto.quantity ?? 0,
          minQuantity: dto.minQuantity ?? 0,
          unit: dto.unit ?? 'unit',
          location: dto.location,
          unitCost: dto.unitCost !== undefined ? money(dto.unitCost) : null,
          supplier: dto.supplier,
        },
      });
      if (dto.quantity)
        await tx.inventoryMovement.create({
          data: {
            tenantId: tid(),
            itemId: it.id,
            type: 'IN',
            quantity: dto.quantity,
            reason: 'Opening stock',
            byId: ctx().userId,
          },
        });
      return it;
    });
    await this.audit.log({ action: 'INVENTORY_ITEM_CREATED', entity: 'InventoryItem', entityId: item.id, after: dto });
    return item;
  }
  update(id: string, dto: Partial<InventoryItemDto>) {
    const { quantity, ...rest } = dto;
    return this.prisma.db.inventoryItem.update({
      where: { id },
      data: { ...rest, unitCost: rest.unitCost !== undefined ? money(rest.unitCost) : undefined },
    });
  }
  async move(id: string, dto: InventoryMoveDto) {
    if (dto.quantity === 0) throw new BadRequestException('Quantity cannot be zero');
    const r = await this.prisma.tenantTx(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Item not found');
      const delta =
        dto.type === 'IN' ? Math.abs(dto.quantity) : dto.type === 'ADJUST' ? dto.quantity : -Math.abs(dto.quantity);
      if (item.quantity + delta < 0) throw new BadRequestException(`Only ${item.quantity} ${item.unit}(s) available`);
      const u = await tx.inventoryItem.update({ where: { id }, data: { quantity: { increment: delta } } });
      await tx.inventoryMovement.create({
        data: { tenantId: tid(), itemId: id, type: dto.type, quantity: delta, reason: dto.reason, byId: ctx().userId },
      });
      return u;
    });
    await this.audit.log({ action: 'INVENTORY_MOVEMENT', entity: 'InventoryItem', entityId: id, after: dto });
    return r;
  }
  movements(id: string) {
    return this.prisma.db.inventoryMovement.findMany({
      where: { itemId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async remove(id: string) {
    await this.prisma.db.inventoryItem.delete({ where: { id } });
    await this.audit.log({ action: 'INVENTORY_ITEM_DELETED', entity: 'InventoryItem', entityId: id });
    return { ok: true };
  }
}
