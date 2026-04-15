import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import aqp from 'api-query-params';
import { Repository } from 'typeorm';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { Partner } from './entities/partner.entity';

@Injectable()
export class PartnersService {
  constructor(
    @InjectRepository(Partner)
    private partnerRepository: Repository<Partner>,
  ) {}

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  async create(createPartnerDto: CreatePartnerDto) {
    const uniqueChecks = [] as Array<{ email?: string; taxCode?: string }>;

    if (createPartnerDto.email) {
      uniqueChecks.push({ email: createPartnerDto.email });
    }

    if (createPartnerDto.taxCode) {
      uniqueChecks.push({ taxCode: createPartnerDto.taxCode });
    }

    const existingPartner = uniqueChecks.length
      ? await this.partnerRepository.findOne({ where: uniqueChecks })
      : null;

    if (existingPartner) {
      throw new BadRequestException('Đối tác đã tồn tại với email hoặc mã số thuế này');
    }

    const partner = this.partnerRepository.create({
      ...createPartnerDto,
      contactName: createPartnerDto.contactName ?? null,
      email: createPartnerDto.email ?? null,
      phone: createPartnerDto.phone ?? null,
      address: createPartnerDto.address ?? null,
      taxCode: createPartnerDto.taxCode ?? null,
      website: createPartnerDto.website ?? null,
      note: createPartnerDto.note ?? null,
      isActive: createPartnerDto.isActive ?? true,
    });

    const savedPartner = await this.partnerRepository.save(partner);

    return savedPartner;
  }

  async findAll(query: string, current: number, pageSize: number) {
    const { filter, sort } = aqp(query);

    if (filter.current) delete filter.current;
    if (filter.pageSize) delete filter.pageSize;
    if (filter.limit) delete filter.limit;

    if (!current) current = 1;
    if (!pageSize) pageSize = 10;

    const skip = (current - 1) * pageSize;
    const queryBuilder = this.partnerRepository.createQueryBuilder('partner');

    for (const key in filter) {
      if (filter[key] instanceof RegExp) {
        queryBuilder.andWhere(`partner.${key} ILIKE :${key}`, { [key]: `%${filter[key].source}%` });
      } else {
        queryBuilder.andWhere(`partner.${key} = :${key}`, { [key]: filter[key] });
      }
    }

    if (sort) {
      for (const key in sort) {
        queryBuilder.addOrderBy(`partner.${key}`, (sort as any)[key] === 1 ? 'ASC' : 'DESC');
      }
    }

    queryBuilder.skip(skip).take(pageSize);

    const [resultsRaw, totalItems] = await queryBuilder.getManyAndCount();
    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      results: resultsRaw,
      totalPages,
    };
  }

  async findOne(id: string) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException(`ID không hợp lệ: ${id}`);
    }

    const partner = await this.partnerRepository.findOneBy({ _id: id });
    if (!partner) {
      throw new NotFoundException('Không tìm thấy đối tác');
    }

    return partner;
  }

  async update(id: string, updatePartnerDto: UpdatePartnerDto) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException(`ID không hợp lệ: ${id}`);
    }

    const existingPartner = await this.partnerRepository.findOneBy({ _id: id });
    if (!existingPartner) {
      throw new NotFoundException('Không tìm thấy đối tác');
    }

    const uniqueChecks = [] as Array<{ email?: string; taxCode?: string }>;

    if (updatePartnerDto.email && updatePartnerDto.email !== existingPartner.email) {
      uniqueChecks.push({ email: updatePartnerDto.email });
    }

    if (updatePartnerDto.taxCode && updatePartnerDto.taxCode !== existingPartner.taxCode) {
      uniqueChecks.push({ taxCode: updatePartnerDto.taxCode });
    }

    if (uniqueChecks.length) {
      const duplicatedPartner = await this.partnerRepository.findOne({ where: uniqueChecks });
      if (duplicatedPartner) {
        throw new BadRequestException('Đối tác đã tồn tại với email hoặc mã số thuế này');
      }
    }

    await this.partnerRepository.update(
      { _id: id },
      {
        contactName: updatePartnerDto.contactName ?? existingPartner.contactName,
        email: updatePartnerDto.email ?? existingPartner.email,
        phone: updatePartnerDto.phone ?? existingPartner.phone,
        address: updatePartnerDto.address ?? existingPartner.address,
        taxCode: updatePartnerDto.taxCode ?? existingPartner.taxCode,
        website: updatePartnerDto.website ?? existingPartner.website,
        note: updatePartnerDto.note ?? existingPartner.note,
        partnerType: updatePartnerDto.partnerType ?? existingPartner.partnerType,
        isActive: updatePartnerDto.isActive ?? existingPartner.isActive,
        name: updatePartnerDto.name ?? existingPartner.name,
      },
    );

    const updatedPartner = await this.partnerRepository.findOneBy({ _id: id });

    return {
      message: 'Cập nhật đối tác thành công',
      data: updatedPartner,
    };
  }

  async remove(id: string) {
    if (!this.isValidUUID(id)) {
      throw new BadRequestException(`ID không hợp lệ: ${id}`);
    }

    const result = await this.partnerRepository.delete({ _id: id });

    if (result.affected === 0) {
      throw new NotFoundException('Không tìm thấy đối tác');
    }

    return {
      message: 'Xoá đối tác thành công',
      deletedCount: result.affected,
    };
  }
}