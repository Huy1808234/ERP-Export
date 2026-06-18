import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { SETTING_KEYS } from './settings.keys';
import { RedisCacheService } from '@/common/cache/redis-cache.service';

const SETTINGS_CACHE_TTL_SECONDS = 900;

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    private readonly cache: RedisCacheService,
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
        description:
          'Company default bank information for invoices and quotations',
      },
      {
        key: 'COMPANY_ADDRESS',
        value: '123 Export Street, Dist 1, HCMC, Vietnam',
        description: 'Company legal address',
      },
      {
        key: SETTING_KEYS.DEFAULT_PURCHASE_VAT_RATE,
        value: '10',
        description: 'Default VAT rate (%) applied to new purchase orders',
      },
      {
        key: SETTING_KEYS.THREE_WAY_MATCHING_QTY_TOLERANCE,
        value: '0',
        description: 'Allowed absolute quantity variance for 3-way matching',
      },
      {
        key: SETTING_KEYS.THREE_WAY_MATCHING_PRICE_TOLERANCE_PERCENT,
        value: '0',
        description:
          'Allowed unit price variance percentage for 3-way matching',
      },
    ];

    for (const setting of defaultSettings) {
      const exists = await this.settingRepository.findOne({
        where: { key: setting.key },
      });
      if (!exists) {
        await this.settingRepository.save(
          this.settingRepository.create(setting),
        );
      }
    }
  }

  async findAll(): Promise<Setting[]> {
    return this.cache.getOrSet(
      'mini-erp:settings:all',
      SETTINGS_CACHE_TTL_SECONDS,
      () => this.settingRepository.find(),
    );
  }

  async findOne(key: string): Promise<Setting | null> {
    return this.cache.getOrSet(
      `mini-erp:settings:key:${key}`,
      SETTINGS_CACHE_TTL_SECONDS,
      () => this.settingRepository.findOne({ where: { key } }),
    );
  }

  async getNumber(key: string, fallback: number): Promise<number> {
    const setting = await this.findOne(key);
    const value = Number(setting?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  async update(updateSettingDto: UpdateSettingDto): Promise<Setting> {
    const { key, value, description } = updateSettingDto;
    let setting = await this.settingRepository.findOne({ where: { key } });

    if (!setting) {
      setting = this.settingRepository.create({ key, value, description });
    } else {
      setting.value = value;
      if (description) setting.description = description;
    }

    const saved = await this.settingRepository.save(setting);
    await this.cache.del([
      'mini-erp:settings:all',
      `mini-erp:settings:key:${key}`,
    ]);
    return saved;
  }

  async bulkUpdate(settings: UpdateSettingDto[]): Promise<Setting[]> {
    const results: Setting[] = [];
    for (const s of settings) {
      results.push(await this.update(s));
    }
    await this.cache.del('mini-erp:settings:all');
    return results;
  }
}
