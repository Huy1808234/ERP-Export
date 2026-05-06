import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
  ) {}

  async onModuleInit() {
    await this.seedSettings();
  }

  private async seedSettings() {
    const defaultSettings = [
      {
        key: 'COMPANY_NAME',
        value: 'ANTIGRAVITY EXPORT CO., LTD',
        description: 'Company legal name for documents',
      },
      {
        key: 'COMPANY_BANK_INFO',
        value: `Bank Name: VIETCOMBANK\nBeneficiary: CÔNG TY TNHH XUẤT NHẬP KHẨU ABC\nAccount Number: 0123456789\nSwift Code: BFTVVNVX`,
        description: 'Company default bank information for invoices and quotations',
      },
      {
        key: 'COMPANY_ADDRESS',
        value: '123 Export Street, Dist 1, HCMC, Vietnam',
        description: 'Company legal address',
      }
    ];

    for (const setting of defaultSettings) {
      const exists = await this.settingRepository.findOne({ where: { key: setting.key } });
      if (!exists) {
        await this.settingRepository.save(this.settingRepository.create(setting));
      }
    }
  }

  async findAll(): Promise<Setting[]> {
    return this.settingRepository.find();
  }

  async findOne(key: string): Promise<Setting | null> {
    return this.settingRepository.findOne({ where: { key } });
  }

  async update(updateSettingDto: UpdateSettingDto): Promise<Setting> {
    const { key, value, description } = updateSettingDto;
    let setting = await this.findOne(key);

    if (!setting) {
      setting = this.settingRepository.create({ key, value, description });
    } else {
      setting.value = value;
      if (description) setting.description = description;
    }

    return this.settingRepository.save(setting);
  }

  async bulkUpdate(settings: UpdateSettingDto[]): Promise<Setting[]> {
    const results: Setting[] = [];
    for (const s of settings) {
      results.push(await this.update(s));
    }
    return results;
  }
}
