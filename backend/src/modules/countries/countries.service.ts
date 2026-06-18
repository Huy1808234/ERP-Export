import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Country } from './entities/country.entity';
import { Port } from '../ports/entities/port.entity';
import { CreateCountryDto } from './dto/create-country.dto';
import { UpdateCountryDto } from './dto/update-country.dto';
import { QueryCountryDto } from './dto/query-country.dto';
import { MarketRegionCode, updateCountryCatalog } from '@/common/geo.util';

type RequestUser = {
  username?: string;
};

type CountryListResponse = {
  meta: {
    current: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  results: Country[];
};

type DefaultCountrySeed = Pick<
  Country,
  'code' | 'name' | 'nameVi' | 'region'
> & {
  aliases: string[];
};

const DEFAULT_COUNTRIES: DefaultCountrySeed[] = [
  {
    code: 'VN',
    name: 'Vietnam',
    nameVi: 'Việt Nam',
    region: MarketRegionCode.ASEAN,
    aliases: ['VIETNAM', 'VIET NAM', 'VN'],
  },
  {
    code: 'US',
    name: 'United States',
    nameVi: 'Hoa Kỳ',
    region: MarketRegionCode.US,
    aliases: ['US', 'USA', 'UNITED STATES', 'AMERICA', 'HOA KY', 'MY'],
  },
  {
    code: 'JP',
    name: 'Japan',
    nameVi: 'Nhật Bản',
    region: MarketRegionCode.APAC,
    aliases: ['JP', 'JAPAN', 'NHAT BAN'],
  },
  {
    code: 'NL',
    name: 'Netherlands',
    nameVi: 'Hà Lan',
    region: MarketRegionCode.EU,
    aliases: ['NL', 'NETHERLANDS', 'HOLLAND', 'HA LAN'],
  },
  {
    code: 'SG',
    name: 'Singapore',
    nameVi: 'Singapore',
    region: MarketRegionCode.ASEAN,
    aliases: ['SG', 'SINGAPORE'],
  },
  {
    code: 'DE',
    name: 'Germany',
    nameVi: 'Đức',
    region: MarketRegionCode.EU,
    aliases: ['DE', 'GERMANY', 'DEUTSCHLAND', 'DUC'],
  },
  {
    code: 'FR',
    name: 'France',
    nameVi: 'Pháp',
    region: MarketRegionCode.EU,
    aliases: ['FR', 'FRANCE', 'PHAP'],
  },
  {
    code: 'IT',
    name: 'Italy',
    nameVi: 'Ý',
    region: MarketRegionCode.EU,
    aliases: ['IT', 'ITALY', 'Y'],
  },
  {
    code: 'ES',
    name: 'Spain',
    nameVi: 'Tây Ban Nha',
    region: MarketRegionCode.EU,
    aliases: ['ES', 'SPAIN', 'TAY BAN NHA'],
  },
  {
    code: 'CN',
    name: 'China',
    nameVi: 'Trung Quốc',
    region: MarketRegionCode.APAC,
    aliases: ['CN', 'CHINA', 'TRUNG QUOC'],
  },
  {
    code: 'KR',
    name: 'South Korea',
    nameVi: 'Hàn Quốc',
    region: MarketRegionCode.APAC,
    aliases: ['KR', 'KOREA', 'SOUTH KOREA', 'HAN QUOC'],
  },
  {
    code: 'AU',
    name: 'Australia',
    nameVi: 'Úc',
    region: MarketRegionCode.APAC,
    aliases: ['AU', 'AUSTRALIA', 'UC'],
  },
  {
    code: 'TH',
    name: 'Thailand',
    nameVi: 'Thái Lan',
    region: MarketRegionCode.ASEAN,
    aliases: ['TH', 'THAILAND', 'THAI LAN'],
  },
  {
    code: 'MY',
    name: 'Malaysia',
    nameVi: 'Malaysia',
    region: MarketRegionCode.ASEAN,
    aliases: ['MY', 'MALAYSIA'],
  },
  {
    code: 'ID',
    name: 'Indonesia',
    nameVi: 'Indonesia',
    region: MarketRegionCode.ASEAN,
    aliases: ['ID', 'INDONESIA'],
  },
  {
    code: 'PH',
    name: 'Philippines',
    nameVi: 'Philippines',
    region: MarketRegionCode.ASEAN,
    aliases: ['PH', 'PHILIPPINES'],
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    nameVi: 'UAE',
    region: MarketRegionCode.MIDDLE_EAST,
    aliases: ['AE', 'UAE', 'UNITED ARAB EMIRATES'],
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    nameVi: 'Saudi Arabia',
    region: MarketRegionCode.MIDDLE_EAST,
    aliases: ['SA', 'SAUDI', 'SAUDI ARABIA'],
  },
  {
    code: 'QA',
    name: 'Qatar',
    nameVi: 'Qatar',
    region: MarketRegionCode.MIDDLE_EAST,
    aliases: ['QA', 'QATAR'],
  },
];

@Injectable()
export class CountriesService implements OnModuleInit {
  constructor(
    @InjectRepository(Country)
    private readonly countryRepository: Repository<Country>,
    @InjectRepository(Port)
    private readonly portRepository: Repository<Port>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaultCountries();
  }

  async ensureDefaultCountries(): Promise<void> {
    for (const item of DEFAULT_COUNTRIES) {
      const existing = await this.countryRepository.findOne({
        where: { code: item.code },
      });
      if (!existing) {
        await this.countryRepository.save(this.countryRepository.create(item));
      }
    }
    await this.syncGeoUtil();
  }

  async syncGeoUtil(): Promise<void> {
    const list = await this.countryRepository.find({
      where: { isActive: true },
    });
    const catalogItems = list.map((item) => ({
      code: item.code,
      name: item.name,
      nameVi: item.nameVi,
      region: item.region,
      aliases: item.aliases || [],
    }));
    updateCountryCatalog(catalogItems);
  }

  async create(dto: CreateCountryDto, user?: RequestUser): Promise<Country> {
    const code = dto.code?.trim().toUpperCase();
    if (!code) {
      throw new BadRequestException('Mã quốc gia là bắt buộc');
    }

    const existing = await this.countryRepository.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException('Mã quốc gia đã tồn tại');
    }

    const country = this.countryRepository.create({
      ...dto,
      code,
      aliases: dto.aliases?.map((a) => a.trim()).filter(Boolean) || [],
    });

    const saved = await this.countryRepository.save(country);
    await this.syncGeoUtil();
    return saved;
  }

  async findAll(query: QueryCountryDto): Promise<CountryListResponse> {
    const current = Math.max(1, query.current || 1);
    const pageSize = Math.min(1000, Math.max(1, query.pageSize || 20));
    const builder = this.countryRepository
      .createQueryBuilder('country')
      .orderBy('country.code', 'ASC')
      .skip((current - 1) * pageSize)
      .take(pageSize);

    if (query.isActive !== undefined) {
      builder.andWhere('country.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    if (query.region) {
      builder.andWhere('country.region = :region', { region: query.region });
    }

    if (query.search) {
      const keyword = `%${query.search.toLowerCase()}%`;
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(country.code) LIKE :keyword', { keyword })
            .orWhere('LOWER(country.name) LIKE :keyword', { keyword })
            .orWhere('LOWER(country.nameVi) LIKE :keyword', { keyword })
            .orWhere('LOWER(country.aliases) LIKE :keyword', { keyword });
        }),
      );
    }

    const [results, total] = await builder.getManyAndCount();
    return {
      meta: {
        current,
        pageSize,
        pages: Math.max(1, Math.ceil(total / pageSize)),
        total,
      },
      results,
    };
  }

  async findOne(recordId: string): Promise<Country> {
    const country = await this.countryRepository.findOne({
      where: { _id: recordId },
    });
    if (!country) {
      throw new NotFoundException('Không tìm thấy quốc gia');
    }
    return country;
  }

  async findByCode(code: string): Promise<Country | null> {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return null;
    return this.countryRepository.findOne({ where: { code: normalized } });
  }

  async update(
    recordId: string,
    dto: UpdateCountryDto,
    user?: RequestUser,
  ): Promise<Country> {
    const country = await this.findOne(recordId);

    const nextCode = dto.code?.trim().toUpperCase();
    if (nextCode && nextCode !== country.code) {
      throw new BadRequestException('Không được đổi mã quốc gia sau khi tạo');
    }

    Object.assign(country, {
      ...dto,
      ...(dto.aliases
        ? { aliases: dto.aliases.map((a) => a.trim()).filter(Boolean) }
        : {}),
    });

    const saved = await this.countryRepository.save(country);
    await this.syncGeoUtil();
    return saved;
  }

  async remove(recordId: string, user?: RequestUser): Promise<void> {
    const country = await this.findOne(recordId);
    const activePorts = await this.portRepository.count({
      where: {
        countryCode: country.code,
        isActive: true,
      },
    });
    if (activePorts > 0) {
      throw new BadRequestException(
        'Không thể ngưng quốc gia khi còn cảng đang hoạt động',
      );
    }
    country.isActive = false;
    await this.countryRepository.save(country);
    await this.syncGeoUtil();
  }
}
