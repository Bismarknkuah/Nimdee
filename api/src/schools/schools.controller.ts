import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowInactiveTenant, RequireFeature, RequirePermissions } from '../common/decorators';
import {
  AddDomainDto,
  UpdateBrandingDto,
  UpdateFeaturesDto,
  UpdateSchoolProfileDto,
  UpdateSettingsDto,
  WebsiteConfigDto,
} from './dto';
import { SchoolsService } from './schools.service';

@ApiTags('school')
@Controller('school')
export class SchoolsController {
  constructor(private readonly schools: SchoolsService) {}

  @Get('profile') @AllowInactiveTenant() profile() {
    return this.schools.profile();
  }
  @Patch('profile') @RequirePermissions('SCHOOL_MANAGE') @AllowInactiveTenant() updateProfile(
    @Body() dto: UpdateSchoolProfileDto,
  ) {
    return this.schools.updateProfile(dto);
  }
  @Patch('branding') @RequirePermissions('SCHOOL_MANAGE') updateBranding(@Body() dto: UpdateBrandingDto) {
    return this.schools.updateBranding(dto);
  }

  @Get('features') @RequirePermissions('SCHOOL_MANAGE') getFeatures() {
    return this.schools.getFeatureSettings();
  }
  @Patch('features') @RequirePermissions('SCHOOL_MANAGE') updateFeatures(@Body() dto: UpdateFeaturesDto) {
    return this.schools.updateFeatureSettings(dto);
  }

  @Get('settings') @RequirePermissions('SETTINGS_MANAGE') settings() {
    return this.schools.getSettings();
  }
  @Patch('settings') @RequirePermissions('SETTINGS_MANAGE') updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.schools.updateSettings(dto);
  }

  @Get('domains') @RequirePermissions('SCHOOL_MANAGE') domains() {
    return this.schools.listDomains();
  }
  @Post('domains') @RequirePermissions('SCHOOL_MANAGE') @RequireFeature('CUSTOM_DOMAIN') addDomain(
    @Body() dto: AddDomainDto,
  ) {
    return this.schools.addDomain(dto);
  }
  @Post('domains/:id/verify') @RequirePermissions('SCHOOL_MANAGE') verify(@Param('id') id: string) {
    return this.schools.verifyDomain(id);
  }
  @Post('domains/:id/primary') @RequirePermissions('SCHOOL_MANAGE') primary(@Param('id') id: string) {
    return this.schools.setPrimaryDomain(id);
  }
  @Delete('domains/:id') @RequirePermissions('SCHOOL_MANAGE') removeDomain(@Param('id') id: string) {
    return this.schools.deleteDomain(id);
  }

  @Get('website') @RequirePermissions('WEBSITE_MANAGE') @RequireFeature('WEBSITE') website() {
    return this.schools.getWebsite();
  }
  @Put('website') @RequirePermissions('WEBSITE_MANAGE') @RequireFeature('WEBSITE') updateWebsite(
    @Body() dto: WebsiteConfigDto,
  ) {
    return this.schools.updateWebsite(dto);
  }
}
