import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository, In } from 'typeorm';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { BuyerRiskLevel, Partner } from './entities/partner.entity';
import { Quotation } from '@/modules/quotations/entities/quotation.entity';
import {
  PIStatus,
  ProformaInvoice,
} from '@/modules/proforma-invoices/entities/proforma-invoice.entity';
import { Shipment } from '@/modules/shipments/entities/shipment.entity';
import { CurrenciesService } from '../currencies/currencies.service';
import { ExchangeRateType } from '../currencies/entities/exchange-rate.entity';
import { Decimal } from 'decimal.js';
import * as XLSX from 'xlsx';

@Injectable()
export class PartnersService {
  constructor(
    @InjectRepository(Partner)
    private partnerRepository: Repository<Partner>,

    @InjectRepository(Quotation)
    private quotationRepository: Repository<Quotation>,

    @InjectRepository(ProformaInvoice)
    private proformaInvoiceRepository: Repository<ProformaInvoice>,

    @InjectRepository(Shipment)
    private shipmentRepository: Repository<Shipment>,

    private currenciesService: CurrenciesService,
  ) { }


  /**
   * Chuyển đổi giá trị sang number an toàn
   */
  private toNumber(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Phân loại mức độ rủi ro dựa trên dư nợ và hạn mức
   */
  private classifyBuyerRisk(
    currentDebt: number,
    creditLimit: number,
    partner: Partner,
  ): BuyerRiskLevel {
    // 1. Ưu tiên ghi đè thủ công (VIP/Special cases)
    if (partner.isManualRisk && partner.manualRiskLevel) {
      return partner.manualRiskLevel;
    }

    // 2. Logic tự động chuẩn
    if (currentDebt <= 0) return BuyerRiskLevel.LOW;
    if (!creditLimit || creditLimit <= 0) return BuyerRiskLevel.HIGH;

    const utilization = currentDebt / creditLimit;
    if (utilization >= 0.8) return BuyerRiskLevel.HIGH;
    if (utilization >= 0.5) return BuyerRiskLevel.MEDIUM;
    return BuyerRiskLevel.LOW;
  }

  private async calculateActualBalances(partnerId: string): Promise<{ arBalance: number, apBalance: number }> {
    try {
      const arResult = await this.partnerRepository.manager.query(
        `SELECT SUM(debit) as debit, SUM(credit) as credit FROM ledger_entries WHERE "accountCode" = '131' AND "partnerId" = $1`,
        [partnerId]
      );

      const arBalance = new Decimal(arResult[0]?.debit || 0).minus(new Decimal(arResult[0]?.credit || 0)).toNumber();

      const apResult = await this.partnerRepository.manager.query(
        `SELECT SUM(debit) as debit, SUM(credit) as credit FROM ledger_entries WHERE "accountCode" = '331' AND "partnerId" = $1`,
        [partnerId]
      );

      const apBalance = new Decimal(apResult[0]?.credit || 0).minus(new Decimal(apResult[0]?.debit || 0)).toNumber();

      return { arBalance, apBalance };
    } catch (error) {
      console.error('Error calculating actual balances for partner', partnerId, ':', error);
      return { arBalance: 0, apBalance: 0 };
    }
  }

  /**
   * Tính tổng dư nợ hiện tại quy đổi theo tiền tệ của đối tác
   */
  private async getCurrentDebt(partner: Partner, actualDebtInVnd: number): Promise<number> {
    const partnerCurrency = partner.defaultCurrency || 'USD';
    const debtInVnd = this.toNumber(actualDebtInVnd);

    if (partnerCurrency === 'VND' || debtInVnd === 0) return debtInVnd;

    try {
      const rateObj = await this.currenciesService.getCrossRate('VND', partnerCurrency, ExchangeRateType.TRANSFER);
      return new Decimal(debtInVnd).times(new Decimal(rateObj.rate)).toNumber();
    } catch (error) {
      // Senior Fallback: Nếu DB chưa có tỷ giá, dùng tỷ giá mặc định thay vì trả về VND sai lệch
      if (partnerCurrency === 'USD') return new Decimal(debtInVnd).div(26128).toNumber();
      if (partnerCurrency === 'EUR') return new Decimal(debtInVnd).div(27500).toNumber();
      return debtInVnd;
    }
  }

  /**
   * Tạo Snapshot thông tin tài chính của Buyer
   */
  private async buildBuyerSnapshot(partner: Partner) {
    const { arBalance, apBalance } = await this.calculateActualBalances(partner.id);
    const currentDebt = await this.getCurrentDebt(partner, arBalance);

    // Đối với AP Balance cũng cần quy đổi nếu khác VND
    const apBalanceConverted = await this.getCurrentDebt(partner, apBalance);

    const creditLimit = this.toNumber(partner.creditLimit);
    const riskLevel = this.classifyBuyerRisk(currentDebt, creditLimit, partner);

    return {
      currentDebt,
      apBalance: apBalanceConverted,
      creditLimit,
      riskLevel,
      isManualRisk: partner.isManualRisk,
      manualRiskLevel: partner.manualRiskLevel,
      availableCredit:
        creditLimit > 0 ? Math.max(creditLimit - currentDebt, 0) : 0,
    };
  }

  private isValidUUID(uuid: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      uuid,
    );
  }

  async create(createPartnerDto: CreatePartnerDto) {
    if (createPartnerDto.taxCode) {
      const existingPartner = await this.partnerRepository.findOne({
        where: { taxCode: createPartnerDto.taxCode },
      });
      if (existingPartner) {
        throw new BadRequestException('Đối tác đã tồn tại với mã số thuế này');
      }
    }

    const partner = this.partnerRepository.create({
      ...createPartnerDto,
      // creditLimit đã được transformer xử lý, gán trực tiếp number
      creditLimit: createPartnerDto.creditLimit ?? 0,
      isActive: createPartnerDto.isActive ?? true,
    });

    const saved = await this.partnerRepository.save(partner);
    return saved;
  }

  async findAll(query: any, current: number, pageSize: number) {
    const aqp = (await import('api-query-params')).default;
    const { filter, sort } = aqp(query);
    ['current', 'pageSize', 'limit', 'skip'].forEach(
      (key) => delete filter[key],
    );

    // Parse to number safely
    const curr = +current || 1;
    const pSize = +pageSize || 10;

    // ✅ TÁCH BIẾN SEARCH
    const searchTerm = filter.search;
    if (filter.search !== undefined) {
      delete filter.search;
    }

    const skip = (curr - 1) * pSize;

    const { current: _c, pageSize: _p, ...filters } = query;
    const queryBuilder = this.partnerRepository.createQueryBuilder('partner');

    // Xử lý filter động
    Object.keys(filter).forEach((key) => {
      if (filter[key] instanceof RegExp) {
        queryBuilder.andWhere(`partner.${key} ILIKE :${key}`, {
          [key]: `%${filter[key].source}%`,
        });
      } else {
        queryBuilder.andWhere(`partner.${key} = :${key}`, {
          [key]: filter[key],
        });
      }
    });

    // Xử lý sort
    if (sort) {
      Object.keys(sort).forEach((key) => {
        queryBuilder.addOrderBy(
          `partner.${key}`,
          (sort as any)[key] === 1 ? 'ASC' : 'DESC',
        );
      });
    } else {
      queryBuilder.orderBy('partner.updatedAt', 'DESC');
    }

    queryBuilder.skip(skip).take(pageSize);

    const [resultsRaw, totalItems] = await queryBuilder.getManyAndCount();

    const results = await Promise.all(
      resultsRaw.map(async (item) => {
        const snapshot = await this.buildBuyerSnapshot(item);
        return { ...item, ...snapshot };
      }),
    );

    return {
      results,
      totalPages: Math.ceil(totalItems / pageSize),
      totalItems,
    };
  }

  async findOne(id: string) {
    if (!this.isValidUUID(id))
      throw new BadRequestException(`ID không hợp lệ: ${id}`);

    const partner = await this.partnerRepository.findOneBy({ id }); // Sửa _id -> id
    if (!partner) throw new NotFoundException('Không tìm thấy đối tác');

    const snapshot = await this.buildBuyerSnapshot(partner);
    return { ...partner, ...snapshot };
  }

  async getPartnerHistory(id: string) {
    if (!this.isValidUUID(id))
      throw new BadRequestException(`ID không hợp lệ: ${id}`);

    const partner = await this.partnerRepository.findOneBy({ id });
    if (!partner) throw new NotFoundException('Không tìm thấy đối tác');

    const [quotations, quotationTotal, piItems, piTotal, shipmentsRaw, shipmentTotal, snapshot] =
      await Promise.all([
        // Chỉ lấy Quotations cho Customer
        partner.partnerType === 'CUSTOMER' ? 
          this.quotationRepository.find({
            where: { customerId: id },
            order: { updatedAt: 'DESC' },
            take: 5,
          }) : Promise.resolve([]),
        partner.partnerType === 'CUSTOMER' ? 
          this.quotationRepository.count({ where: { customerId: id } }) : Promise.resolve(0),
        
        // Chỉ lấy PI cho Customer
        partner.partnerType === 'CUSTOMER' ? 
          this.proformaInvoiceRepository.find({
            where: { customerId: id },
            order: { updatedAt: 'DESC' },
            take: 5,
          }) : Promise.resolve([]),
        partner.partnerType === 'CUSTOMER' ? 
          this.proformaInvoiceRepository.count({ where: { customerId: id } }) : Promise.resolve(0),

        // Lấy Shipments cho Logistics
        partner.partnerType === 'LOGISTICS' ? 
          this.shipmentRepository.find({
            where: { logisticsPartnerId: id },
            order: { updatedAt: 'DESC' },
            take: 10,
          }) : Promise.resolve([]),
        partner.partnerType === 'LOGISTICS' ? 
          this.shipmentRepository.count({ where: { logisticsPartnerId: id } }) : Promise.resolve(0),

        this.buildBuyerSnapshot(partner),
      ]);

    const getLatestDate = (...dates: (Date | undefined)[]) => {
      const validDates = dates.filter((d): d is Date => !!d);
      return validDates.length
        ? new Date(Math.max(...validDates.map((d) => d.getTime())))
        : null;
    };

    const lastActivityAt = getLatestDate(
      quotations[0]?.updatedAt,
      piItems[0]?.updatedAt,
      shipmentsRaw[0]?.updatedAt,
    );

    return {
      partner: { ...partner, ...snapshot },
      quotations: { total: quotationTotal, items: quotations },
      proformaInvoices: { total: piTotal, items: piItems },
      shipments: { total: shipmentTotal, items: shipmentsRaw },
      lastActivityAt,
    };
  }

  async update(
    id: string,
    updatePartnerDto: UpdatePartnerDto,
    requestRole?: string,
  ) {
    if (!this.isValidUUID(id))
      throw new BadRequestException(`ID không hợp lệ: ${id}`);

    const existingPartner = await this.partnerRepository.findOneBy({ id });
    if (!existingPartner) throw new NotFoundException('Không tìm thấy đối tác');

    // Logic kiểm tra TaxCode
    if (
      updatePartnerDto.taxCode &&
      updatePartnerDto.taxCode !== existingPartner.taxCode
    ) {
      const exists = await this.partnerRepository.count({
        where: { taxCode: updatePartnerDto.taxCode },
      });
      if (exists > 0)
        throw new BadRequestException('Đối tác đã tồn tại với mã số thuế này');
    }

    // Logic kiểm tra hạn mức tín dụng (Credit Limit)
    const currentSnapshot = await this.buildBuyerSnapshot(existingPartner);
    const existingLimit = this.toNumber(existingPartner.creditLimit);
    const newLimit =
      updatePartnerDto.creditLimit !== undefined
        ? Number(updatePartnerDto.creditLimit)
        : existingLimit;

    // Logic check canApprove linh hoạt hơn
    let roleStr = '';
    if (typeof requestRole === 'string') {
      roleStr = requestRole.toUpperCase();
    } else if (requestRole && typeof requestRole === 'object' && (requestRole as any).name) {
      roleStr = (requestRole as any).name.toUpperCase();
    }

    const canApprove = ['MANAGER', 'DIRECTOR', 'ADMIN'].includes(roleStr);

    if (
      newLimit > existingLimit &&
      currentSnapshot.riskLevel === BuyerRiskLevel.HIGH &&
      !canApprove
    ) {
      throw new BadRequestException(
        'Khách hàng rủi ro cao: Chỉ Quản lý mới được tăng hạn mức tín dụng',
      );
    }

    // Update payload
    const payload = Object.fromEntries(
      Object.entries(updatePartnerDto).filter(
        ([, value]) => value !== undefined,
      ),
    );

    // Sử dụng merge + save để kích hoạt đầy đủ Transformer và Listener
    this.partnerRepository.merge(existingPartner, payload);
    const updatedPartner = await this.partnerRepository.save(existingPartner);

    const updatedSnapshot = await this.buildBuyerSnapshot(updatedPartner);

    return {
      message: 'Cập nhật đối tác thành công',
      data: { ...updatedPartner, ...updatedSnapshot },
    };
  }

  async remove(id: string) {
    if (!this.isValidUUID(id))
      throw new BadRequestException(`ID không hợp lệ: ${id}`);

    // Soft delete để giữ lại lịch sử giao dịch trong DB
    const result = await this.partnerRepository.softDelete({ id });

    if (result.affected === 0)
      throw new NotFoundException('Không tìm thấy đối tác');
    return { message: 'Xoá đối tác thành công', deletedCount: result.affected };
  }

  async bulkRemove(ids: string[]) {
    // Kiểm tra tất cả ID có hợp lệ không
    ids.forEach(id => {
      if (!this.isValidUUID(id)) throw new BadRequestException(`ID không hợp lệ: ${id}`);
    });

    const result = await this.partnerRepository.softDelete(ids);
    return {
      message: `Xoá thành công ${result.affected} đối tác`,
      deletedCount: result.affected,
    };
  }

  async exportExcel(query: any) {
    const aqp = (await import('api-query-params')).default;
    const { filter, sort } = aqp(query);
    ['current', 'pageSize', 'limit', 'skip'].forEach(
      (key) => delete filter[key],
    );

    const queryBuilder = this.partnerRepository.createQueryBuilder('partner');

    // Xử lý filter động
    Object.keys(filter).forEach((key) => {
      if (filter[key] instanceof RegExp) {
        queryBuilder.andWhere(`partner.${key} ILIKE :${key}`, {
          [key]: `%${filter[key].source}%`,
        });
      } else {
        queryBuilder.andWhere(`partner.${key} = :${key}`, {
          [key]: filter[key],
        });
      }
    });

    // Xử lý sort
    if (sort) {
      Object.keys(sort).forEach((key) => {
        queryBuilder.addOrderBy(
          `partner.${key}`,
          (sort as any)[key] === 1 ? 'ASC' : 'DESC',
        );
      });
    } else {
      queryBuilder.orderBy('partner.updatedAt', 'DESC');
    }

    const results = await queryBuilder.getMany();

    // Map dữ liệu sang format Excel
    const data = results.map((p) => ({
      'ID': p.id,
      'Tên Đối Tác': p.name,
      'Loại Đối Tác': p.partnerType === 'CUSTOMER' ? 'Khách hàng (Buyer)' : (p.partnerType === 'SUPPLIER' ? 'Nhà cung cấp (Vendor)' : 'Đơn vị vận chuyển (Logistics)'),
      'Quốc Gia': p.country || 'Việt Nam',
      'Khu Vực': p.region || 'N/A',
      'Mã Số Thuế': p.taxCode || 'N/A',
      'Tiền Tệ Mặc Định': p.defaultCurrency || 'USD',
      'Hạn Mức Tín Dụng': p.creditLimit || 0,
      'Điều Khoản Thanh Toán': p.defaultPaymentTerm || 'N/A',
      'Trạng Thái': p.isActive ? 'Hoạt động' : 'Đang khóa',
      'Ngày Cập Nhật': p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('vi-VN') : 'N/A'
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Danh Sách Đối Tác');

    // Thiết lập độ rộng cột cơ bản
    const wscols = [
      { wch: 10 }, { wch: 30 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
      { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 20 }
    ];
    worksheet['!cols'] = wscols;

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
  }
}
