import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingDto, BulkUpdateSettingsDto } from './dto/update-setting.dto';
import { JwtAuthGuard } from '../../auth/passport/jwt-auth.guard';
import { RolesGuard } from '../../auth/passport/roles.guard';
import { Roles } from '../../decorator/customize';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  @Post()
  @Roles('ADMIN')
  update(@Body() updateSettingDto: UpdateSettingDto) {
    return this.settingsService.update(updateSettingDto);
  }

  @Post('bulk')
  @Roles('ADMIN')
  bulkUpdate(@Body() bulkUpdateSettingsDto: BulkUpdateSettingsDto) {
    return this.settingsService.bulkUpdate(bulkUpdateSettingsDto.settings);
  }
}
