import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partner, PartnerType } from '@/modules/partners/entities/partner.entity';
import { CreateAccountPayableDto } from './dto/create-account-payable.dto';
import { UpdateAccountPayableDto } from './dto/update-account-payable.dto';
import { AccountPayable, APStatus } from './entities/account-payable.entity';

@Injectable()
export class AccountPayablesService {
  constructor(
    @InjectRepository(AccountPayable)
    private readonly accountPayableRepository: Repository<AccountPayable>,
    @InjectRepository(Partner)
    private readonly partnerRepository: Repository<Partner>,
  ) {}

  private async validateVendor(vendorId: string) {
    const vendor = await this.partnerRepository.findOneBy({ id: vendorId });
    if (!vendor) throw new BadRequestException('Nha cung cap khong ton tai');
    if (vendor.partnerType !== PartnerType.SUPPLIER) {
      throw new BadRequestException('Doi tac khong phai nha cung cap');
    }
  }

  private normalizeStatus(ap: AccountPayable) {
    if (ap.paidAmount <= 0) return APStatus.UNPAID;
    if (ap.paidAmount >= ap.amount) return APStatus.PAID;
    return APStatus.PARTIAL;
  }

  async create(dto: CreateAccountPayableDto) {
    await this.validateVendor(dto.vendorId);

    const entity = this.accountPayableRepository.create({
      ...dto,
      paidAmount: dto.paidAmount ?? 0,
      currency: dto.currency ?? 'VND',
      status: dto.status ?? APStatus.UNPAID,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    });

    entity.status = this.normalizeStatus(entity);

    return this.accountPayableRepository.save(entity);
  }

  async findAll(vendorId?: string, status?: APStatus) {
    const qb = this.accountPayableRepository
      .createQueryBuilder('ap')
      .leftJoinAndSelect('ap.vendor', 'vendor');

    if (vendorId) {
      qb.andWhere('ap.vendorId = :vendorId', { vendorId });
    }

    if (status) {
      qb.andWhere('ap.status = :status', { status });
    }

    qb.orderBy('ap.updatedAt', 'DESC');

    return qb.getMany();
  }

  async findOne(id: string) {
    const ap = await this.accountPayableRepository.findOne({
      where: { id },
      relations: { vendor: true },
    });
    if (!ap) throw new NotFoundException('Khong tim thay AP');
    return ap;
  }

  async update(id: string, dto: UpdateAccountPayableDto) {
    const ap = await this.findOne(id);

    const payload = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );

    if (payload.vendorId) {
      await this.validateVendor(payload.vendorId);
    }

    if (payload.dueDate) {
      payload.dueDate = new Date(payload.dueDate as any) as any;
    }

    const merged = { ...ap, ...payload } as AccountPayable;
    merged.status = this.normalizeStatus(merged);
    payload.status = merged.status;

    await this.accountPayableRepository.update({ id }, payload);
    return this.findOne(id);
  }

  async remove(id: string) {
    const result = await this.accountPayableRepository.delete({ id });
    if (result.affected === 0) throw new NotFoundException('Khong tim thay AP');
    return { id, deletedCount: result.affected };
  }
}
