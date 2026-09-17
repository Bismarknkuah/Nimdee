import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';
import { AllowInactiveTenant, RequirePermissions } from '../common/decorators';
import { SubscriptionsService } from './subscriptions.service';

class ChangePlanDto {
  @IsString() planCode: string;
  @IsEnum(['MONTHLY', 'YEARLY']) billingCycle: 'MONTHLY' | 'YEARLY';
}

@ApiTags('subscription')
@AllowInactiveTenant()
@Controller('subscription')
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}
  @Get() @RequirePermissions('SUBSCRIPTION_MANAGE') mine() {
    return this.subs.mine();
  }
  @Post('change') @RequirePermissions('SUBSCRIPTION_MANAGE') change(@Body() dto: ChangePlanDto) {
    return this.subs.requestChange(dto.planCode, dto.billingCycle);
  }
}
