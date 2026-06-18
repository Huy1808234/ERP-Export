import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { CreatePortDto } from './dto/create-port.dto';
import { QueryPortDto } from './dto/query-port.dto';
import { UpdatePortDto } from './dto/update-port.dto';
import { Port, PortType } from './entities/port.entity';
import { normalizeCountryCode } from '@/common/geo.util';
import { CountriesService } from '../countries/countries.service';
import { Country } from '../countries/entities/country.entity';

type RequestUser = {
  username?: string;
};

type PortListResponse = {
  meta: {
    current: number;
    pageSize: number;
    pages: number;
    total: number;
  };
  results: Port[];
};

export type PortSnapshot = {
  port_id: string | null;
  label: string | null;
};

type PortSnapshotPatchInput = {
  incomingPortRef?: string | null;
  incomingLabel?: string | null;
  currentPortRef?: string | null;
  currentLabel?: string | null;
  hasIncomingPortRef: boolean;
  hasIncomingLabel: boolean;
};

const DEFAULT_PORTS: CreatePortDto[] = [
  {
    code: 'VNCMT',
    name: 'Cang Cai Mep',
    localName: 'Cang Cai Mep (Ba Ria - Vung Tau)',
    city: 'Ba Ria - Vung Tau',
    country: 'Vietnam',
    countryCode: 'VN',
    timezone: 'Asia/Ho_Chi_Minh',
    aliases: ['Cai Mep', 'Cai Mep Port', 'CMIT'],
  },
  {
    code: 'VNSGN',
    name: 'Cang Cat Lai',
    localName: 'Cang Cat Lai (TP.HCM)',
    city: 'Ho Chi Minh City',
    country: 'Vietnam',
    countryCode: 'VN',
    timezone: 'Asia/Ho_Chi_Minh',
    aliases: ['Cat Lai', 'Cat Lai Port', 'Sai Gon'],
  },
  {
    code: 'VNHPH',
    name: 'Cang Hai Phong',
    localName: 'Cang Hai Phong',
    city: 'Hai Phong',
    country: 'Vietnam',
    countryCode: 'VN',
    timezone: 'Asia/Ho_Chi_Minh',
    aliases: ['Hai Phong Port'],
  },
  {
    code: 'USLAX',
    name: 'Port of Los Angeles',
    city: 'Los Angeles',
    country: 'United States',
    countryCode: 'US',
    timezone: 'America/Los_Angeles',
    aliases: ['Los Angeles', 'LA Port'],
  },
  {
    code: 'JPOSA',
    name: 'Port of Osaka',
    city: 'Osaka',
    country: 'Japan',
    countryCode: 'JP',
    timezone: 'Asia/Tokyo',
    aliases: ['Osaka'],
  },
  {
    code: 'NLRTM',
    name: 'Port of Rotterdam',
    city: 'Rotterdam',
    country: 'Netherlands',
    countryCode: 'NL',
    timezone: 'Europe/Amsterdam',
    aliases: ['Rotterdam'],
  },
  {
    code: 'SGSIN',
    name: 'Port of Singapore',
    city: 'Singapore',
    country: 'Singapore',
    countryCode: 'SG',
    timezone: 'Asia/Singapore',
    aliases: ['Singapore'],
  },
];

@Injectable()
export class PortsService implements OnModuleInit {
  constructor(
    @InjectRepository(Port)
    private readonly portRepository: Repository<Port>,
    private readonly countriesService: CountriesService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.countriesService.ensureDefaultCountries();
    for (const item of DEFAULT_PORTS) {
      const existing = await this.portRepository.findOne({
        where: { code: item.code },
        withDeleted: true,
      });
      if (!existing) {
        await this.portRepository.save(
          this.portRepository.create({
            ...item,
            type: item.type || PortType.SEA,
          }),
        );
      }
    }
  }

  async create(dto: CreatePortDto, user?: RequestUser): Promise<Port> {
    const payload = await this.normalizeCreatePayload(dto);
    const existing = await this.portRepository.findOne({
      where: { code: payload.code },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException('Ma cang bien da ton tai');
    }

    const port = this.portRepository.create({
      ...payload,
      createdByUsername: user?.username || null,
      updatedByUsername: user?.username || null,
    });
    return this.portRepository.save(port);
  }

  async findAll(query: QueryPortDto): Promise<PortListResponse> {
    const current = Math.max(1, query.current || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const builder = this.portRepository
      .createQueryBuilder('port')
      .withDeleted()
      .orderBy('port.countryCode', 'ASC')
      .addOrderBy('port.name', 'ASC')
      .skip((current - 1) * pageSize)
      .take(pageSize);

    if (query.isActive !== undefined) {
      builder.andWhere('port.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    if (query.isActive === true) {
      builder.innerJoin(
        Country,
        'country',
        'country.code = port.countryCode AND country.isActive = :countryIsActive',
        { countryIsActive: true },
      );
    }

    if (query.countryCode) {
      builder.andWhere('port.countryCode = :countryCode', {
        countryCode: query.countryCode,
      });
    }

    if (query.type) {
      builder.andWhere('port.type = :type', { type: query.type });
    }

    if (query.search) {
      const keyword = `%${query.search.toLowerCase()}%`;
      builder.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(port.code) LIKE :keyword', { keyword })
            .orWhere('LOWER(port.name) LIKE :keyword', { keyword })
            .orWhere('LOWER(port.localName) LIKE :keyword', { keyword })
            .orWhere('LOWER(port.city) LIKE :keyword', { keyword })
            .orWhere('LOWER(port.country) LIKE :keyword', { keyword })
            .orWhere('LOWER(port.aliases) LIKE :keyword', { keyword });
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

  async findOne(recordId: string): Promise<Port> {
    const port = await this.portRepository.findOne({
      where: { _id: recordId },
      withDeleted: true,
    });
    if (!port) {
      throw new NotFoundException('Khong tim thay cang bien');
    }
    return port;
  }

  async findByIdOrCode(value: string): Promise<Port | null> {
    const normalized = value.trim();
    if (!normalized) return null;

    return this.portRepository.findOne({
      where: [{ _id: normalized }, { code: normalized.toUpperCase() }],
      withDeleted: true,
    });
  }

  formatPortLabel(port: Port): string {
    const displayName = port.localName || port.name;
    return `${port.code} - ${displayName}`;
  }

  async resolvePortSnapshot(
    portRef?: string | null,
    fallbackText?: string | null,
  ): Promise<PortSnapshot> {
    const normalizedReference = portRef?.trim();
    if (normalizedReference) {
      const port = await this.findByIdOrCode(normalizedReference);
      if (!port) {
        throw new BadRequestException(
          `Khong tim thay cang bien: ${normalizedReference}`,
        );
      }
      if (!port.isActive || port.deletedAt) {
        throw new BadRequestException(
          `Cang bien ${port.code} dang ngung hoat dong`,
        );
      }
      return {
        port_id: port._id,
        label: this.formatPortLabel(port),
      };
    }

    const normalizedFallback = fallbackText?.trim();
    return {
      port_id: null,
      label:
        normalizedFallback && normalizedFallback.length > 0
          ? normalizedFallback
          : null,
    };
  }

  async resolvePortSnapshotPatch(
    input: PortSnapshotPatchInput,
  ): Promise<PortSnapshot> {
    if (!input.hasIncomingPortRef && !input.hasIncomingLabel) {
      return {
        port_id: input.currentPortRef?.trim() || null,
        label: input.currentLabel?.trim() || null,
      };
    }

    if (input.hasIncomingPortRef) {
      return this.resolvePortSnapshot(
        input.incomingPortRef,
        input.incomingLabel,
      );
    }

    return this.resolvePortSnapshot(null, input.incomingLabel);
  }

  async update(
    recordId: string,
    dto: UpdatePortDto,
    user?: RequestUser,
  ): Promise<Port> {
    const port = await this.findOne(recordId);
    const payload = await this.normalizeUpdatePayload(dto, port);

    if (payload.code && payload.code !== port.code) {
      const duplicated = await this.portRepository.findOne({
        where: { code: payload.code },
        withDeleted: true,
      });
      if (duplicated && duplicated._id !== port._id) {
        throw new ConflictException('Ma cang bien da ton tai');
      }
    }

    if (payload.isActive === true && port.deletedAt) {
      port.deletedAt = null;
    }

    Object.assign(port, payload, {
      updatedByUsername: user?.username || port.updatedByUsername || null,
    });
    return this.portRepository.save(port);
  }

  async remove(recordId: string, user?: RequestUser): Promise<void> {
    const port = await this.findOne(recordId);
    port.isActive = false;
    port.deletedAt = null;
    port.updatedByUsername = user?.username || port.updatedByUsername || null;
    await this.portRepository.save(port);
  }

  private async resolveActiveCountry(countryCode: string): Promise<string> {
    const country = await this.countriesService.findByCode(countryCode);
    if (!country) {
      throw new BadRequestException(`Khong tim thay quoc gia: ${countryCode}`);
    }
    if (!country.isActive) {
      throw new BadRequestException(
        `Quoc gia ${country.code} dang ngung hoat dong`,
      );
    }
    return country.name;
  }

  private async normalizeCreatePayload(
    dto: CreatePortDto,
  ): Promise<Partial<Port> & Pick<Port, 'code'>> {
    const code = dto.code?.trim().replace(/\s+/g, '').toUpperCase();
    if (!code) {
      throw new BadRequestException('Ma cang bien la bat buoc');
    }
    const countryCode = normalizeCountryCode(dto.countryCode);
    if (!countryCode) {
      throw new BadRequestException('Ma quoc gia la bat buoc');
    }
    const country = await this.resolveActiveCountry(countryCode);

    return {
      code,
      name: dto.name?.trim(),
      localName: dto.localName?.trim() || null,
      city: dto.city?.trim() || null,
      country,
      countryCode,
      type: dto.type || PortType.SEA,
      timezone: dto.timezone?.trim() || null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      aliases: dto.aliases?.map((item) => item.trim()).filter(Boolean) || null,
      notes: dto.notes?.trim() || null,
      isActive: dto.isActive ?? true,
    } as Partial<Port> & Pick<Port, 'code'>;
  }

  private async normalizeUpdatePayload(
    dto: UpdatePortDto,
    currentPort: Port,
  ): Promise<Partial<Port>> {
    const countryCode =
      dto.countryCode !== undefined
        ? normalizeCountryCode(dto.countryCode) || undefined
        : undefined;
    const country = countryCode
      ? await this.resolveActiveCountry(countryCode)
      : dto.country?.trim() || undefined;

    if (dto.isActive === true && !countryCode) {
      await this.resolveActiveCountry(currentPort.countryCode);
    }

    return {
      ...(dto.code
        ? { code: dto.code.trim().replace(/\s+/g, '').toUpperCase() }
        : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.localName !== undefined
        ? { localName: dto.localName?.trim() || null }
        : {}),
      ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
      ...(dto.country !== undefined || countryCode ? { country } : {}),
      ...(countryCode !== undefined ? { countryCode } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.timezone !== undefined
        ? { timezone: dto.timezone?.trim() || null }
        : {}),
      ...(dto.latitude !== undefined ? { latitude: dto.latitude ?? null } : {}),
      ...(dto.longitude !== undefined
        ? { longitude: dto.longitude ?? null }
        : {}),
      ...(dto.aliases !== undefined
        ? {
            aliases:
              dto.aliases?.map((item) => item.trim()).filter(Boolean) || null,
          }
        : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
  }
}
