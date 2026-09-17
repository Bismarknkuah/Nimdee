import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequireFeature, RequirePermissions } from '../common/decorators';
import { CanteenService } from './canteen.service';
import { CanteenItemDto, SaleDto, StockDto, TopUpDto, WalletSettingsDto } from './dto';

@ApiTags('canteen')
@RequireFeature('CANTEEN')
@Controller('canteen')
export class CanteenController {
  constructor(private readonly canteen: CanteenService) {}

  @Get('items') @RequirePermissions('CANTEEN_VIEW') items(@Query('all') all?: string) {
    return this.canteen.items(all === 'true');
  }
  @Post('items') @RequirePermissions('CANTEEN_MANAGE') createItem(@Body() dto: CanteenItemDto) {
    return this.canteen.createItem(dto);
  }
  @Patch('items/:id') @RequirePermissions('CANTEEN_MANAGE') updateItem(
    @Param('id') id: string,
    @Body() dto: Partial<CanteenItemDto>,
  ) {
    return this.canteen.updateItem(id, dto);
  }
  @Post('items/:id/stock') @RequirePermissions('CANTEEN_MANAGE') stock(@Param('id') id: string, @Body() dto: StockDto) {
    return this.canteen.adjustStock(id, dto);
  }
  @Get('items/:id/movements') @RequirePermissions('CANTEEN_VIEW') movements(@Param('id') id: string) {
    return this.canteen.movements(id);
  }
  @Get('low-stock') @RequirePermissions('CANTEEN_VIEW') low() {
    return this.canteen.lowStock();
  }

  @Get('wallets/:studentId') @RequirePermissions('CANTEEN_VIEW') wallet(@Param('studentId') id: string) {
    return this.canteen.wallet(id);
  }
  @Post('wallets/:studentId/topup') @RequirePermissions('WALLET_TOPUP') topup(
    @Param('studentId') id: string,
    @Body() dto: TopUpDto,
  ) {
    return this.canteen.topUp(id, dto);
  }
  @Patch('wallets/:studentId') @RequirePermissions('CANTEEN_MANAGE') settings(
    @Param('studentId') id: string,
    @Body() dto: WalletSettingsDto,
  ) {
    return this.canteen.walletSettings(id, dto);
  }

  @Post('sales') @RequirePermissions('CANTEEN_SELL') sell(@Body() dto: SaleDto) {
    return this.canteen.sell(dto);
  }
  @Get('sales') @RequirePermissions('CANTEEN_VIEW') sales(@Query('date') date?: string) {
    return this.canteen.sales(date);
  }
  @Get('summary') @RequirePermissions('CANTEEN_VIEW') summary(@Query('date') date?: string) {
    return this.canteen.summary(date);
  }
}
