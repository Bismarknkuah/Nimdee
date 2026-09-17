import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { InventoryItemDto, InventoryMoveDto } from './dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@RequireFeature('INVENTORY')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inv: InventoryService) {}
  @Get('items') @RequirePermissions('INVENTORY_VIEW') items(@Query('search') s?: string) {
    return this.inv.items(s);
  }
  @Get('low-stock') @RequirePermissions('INVENTORY_VIEW') low() {
    return this.inv.lowStock();
  }
  @Post('items') @RequirePermissions('INVENTORY_MANAGE') create(@Body() dto: InventoryItemDto) {
    return this.inv.create(dto);
  }
  @Patch('items/:id') @RequirePermissions('INVENTORY_MANAGE') update(
    @Param('id') id: string,
    @Body() dto: Partial<InventoryItemDto>,
  ) {
    return this.inv.update(id, dto);
  }
  @Delete('items/:id') @RequirePermissions('INVENTORY_MANAGE') remove(@Param('id') id: string) {
    return this.inv.remove(id);
  }
  @Post('items/:id/move') @RequirePermissions('INVENTORY_MANAGE') move(
    @Param('id') id: string,
    @Body() dto: InventoryMoveDto,
  ) {
    return this.inv.move(id, dto);
  }
  @Get('items/:id/movements') @RequirePermissions('INVENTORY_VIEW') movements(@Param('id') id: string) {
    return this.inv.movements(id);
  }
}
