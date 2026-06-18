import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, FindOptionsWhere } from 'typeorm';
import { ProformaInvoice, PIStatus } from './entities/proforma-invoice.entity';
import type { QueryParams } from '@/common/types/authenticated-user.type';
import { ProformaInvoiceItem } from './entities/proforma-invoice-item.entity';
import {
  CreateProformaInvoiceDto,
  ConvertQuotationToPiDto,
} from '@/modules/proforma-invoices/dto/create-proforma-invoice.dto';
import { UpdateProformaInvoiceDto } from '@/modules/proforma-invoices/dto/update-proforma-invoice.dto';
import { User } from '@/modules/users/entities/user.entity';
import { QuotationsService } from '../quotations/quotations.service';
import {
  QuotationStatus,
  Quotation,
} from '../quotations/entities/quotation.entity';
import { Partner } from '@/modules/partners/entities/partner.entity';

import { validateIncotermLogisticsFee } from '@/helpers/incoterm.util';
import { ProductsService } from '../products/products.service';
import { CurrenciesService } from '../currencies/currencies.service';
import { ExchangeRateType } from '../currencies/entities/exchange-rate.entity';
import { Decimal } from 'decimal.js';
import { AccountingService } from '../accounting/accounting.service';
import { createOpaqueCode } from '@/common/ids/entity-id.util';
import { ApprovalMatrixService } from '../approval-matrix/approval-matrix.service';
import { ApprovalDocumentType } from '../approval-matrix/entities/approval-rule.entity';
import { PortsService } from '../ports/ports.service';

type PiRouteInput = Pick<
  Partial<CreateProformaInvoiceDto>,
  | 'portOfLoading'
  | 'portOfLoading_port_id'
  | 'portOfDischarge'
  | 'portOfDischarge_port_id'
>;

type PiRoutePatchInput = PiRouteInput & {
  currentPortOfLoading?: string | null;
  currentPortOfLoadingPortId?: string | null;
  currentPortOfDischarge?: string | null;
  currentPortOfDischargePortId?: string | null;
  hasPortOfLoading: boolean;
  hasPortOfLoadingPortId: boolean;
  hasPortOfDischarge: boolean;
  hasPortOfDischargePortId: boolean;
};

@Injectable()
export class ProformaInvoicesService implements OnModuleInit {
  constructor(
    @InjectRepository(ProformaInvoice)
    private piRepository: Repository<ProformaInvoice>,
    @InjectRepository(ProformaInvoiceItem)
    private piItemsRepository: Repository<ProformaInvoiceItem>,
    private quotationsService: QuotationsService,
    private productsService: ProductsService,
    private currenciesService: CurrenciesService,
    private accountingService: AccountingService,
    private dataSource: DataSource,
    private approvalMatrixService: ApprovalMatrixService,
    private portsService: PortsService,
  ) {}

  async onModuleInit() {
    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'proforma_invoices_status_enum' AND e.enumlabel = 'ACCEPTED') THEN
            ALTER TYPE proforma_invoices_status_enum ADD VALUE 'ACCEPTED';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'proforma_invoices_status_enum' AND e.enumlabel = 'PENDING_APPROVAL') THEN
            ALTER TYPE proforma_invoices_status_enum ADD VALUE 'PENDING_APPROVAL';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'proforma_invoices_status_enum' AND e.enumlabel = 'REJECTED') THEN
            ALTER TYPE proforma_invoices_status_enum ADD VALUE 'REJECTED';
          END IF;
        END
        $$;
      `);
      await queryRunner.release();
    } catch (error) {
      console.warn(
        '[PI] onModuleInit warning:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private async resolvePiPorts<T extends PiRouteInput>(data: T): Promise<T> {
    const loading = await this.portsService.resolvePortSnapshot(
      data.portOfLoading_port_id,
      data.portOfLoading,
    );
    const discharge = await this.portsService.resolvePortSnapshot(
      data.portOfDischarge_port_id,
      data.portOfDischarge,
    );

    return {
      ...data,
      portOfLoading_port_id: loading.port_id,
      portOfLoading: loading.label,
      portOfDischarge_port_id: discharge.port_id,
      portOfDischarge: discharge.label,
    };
  }

  private async resolvePiPortsForUpdate(
    data: PiRoutePatchInput,
  ): Promise<PiRouteInput> {
    const loading = await this.portsService.resolvePortSnapshotPatch({
      incomingPortRef: data.portOfLoading_port_id,
      incomingLabel: data.portOfLoading,
      currentPortRef: data.currentPortOfLoadingPortId,
      currentLabel: data.currentPortOfLoading,
      hasIncomingPortRef: data.hasPortOfLoadingPortId,
      hasIncomingLabel: data.hasPortOfLoading,
    });
    const discharge = await this.portsService.resolvePortSnapshotPatch({
      incomingPortRef: data.portOfDischarge_port_id,
      incomingLabel: data.portOfDischarge,
      currentPortRef: data.currentPortOfDischargePortId,
      currentLabel: data.currentPortOfDischarge,
      hasIncomingPortRef: data.hasPortOfDischargePortId,
      hasIncomingLabel: data.hasPortOfDischarge,
    });

    return {
      portOfLoading_port_id: loading.port_id,
      portOfLoading: loading.label,
      portOfDischarge_port_id: discharge.port_id,
      portOfDischarge: discharge.label,
    };
  }

  async create(createPiDto: CreateProformaInvoiceDto, user: User) {
    const { items, ...piData } = createPiDto;
    if (!piData.paymentTerms) {
      if (piData.quotationId) {
        const quotation = await this.dataSource
          .getRepository(Quotation)
          .findOne({
            where: { _id: piData.quotationId },
          });
        if (quotation?.paymentTerms) {
          piData.paymentTerms = quotation.paymentTerms;
        }
      }
      if (!piData.paymentTerms && piData.customerId) {
        const partner = await this.dataSource.getRepository(Partner).findOne({
          where: { _id: piData.customerId },
        });
        if (partner?.defaultPaymentTerm) {
          piData.paymentTerms = partner.defaultPaymentTerm;
        }
      }
    }
    const piRouteData = await this.resolvePiPorts(piData);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const suffix = createOpaqueCode('pi_no').split('_').pop()?.toUpperCase();
      const piNumber = `PI-${dateStr}-${suffix}`;

      let itemsSum = new Decimal(0);
      for (const item of items) {
        itemsSum = itemsSum.plus(
          new Decimal(item.quantity).times(new Decimal(item.unitPrice)),
        );
      }

      const docCurrency = createPiDto.currency || 'USD';
      let logisticsFeeInDoc = new Decimal(createPiDto.logisticsFee || 0);
      if (
        createPiDto.logisticsFeeCurrency &&
        createPiDto.logisticsFeeCurrency !== docCurrency
      ) {
        const crossRateObj = await this.currenciesService.getCrossRate(
          createPiDto.logisticsFeeCurrency,
          docCurrency,
          ExchangeRateType.TRANSFER,
        );
        logisticsFeeInDoc = logisticsFeeInDoc.times(
          new Decimal(crossRateObj.rate),
        );
      }

      let otherFeeInDoc = new Decimal(createPiDto.otherFee || 0);
      if (
        createPiDto.otherFeeCurrency &&
        createPiDto.otherFeeCurrency !== docCurrency
      ) {
        const crossRateObj = await this.currenciesService.getCrossRate(
          createPiDto.otherFeeCurrency,
          docCurrency,
          ExchangeRateType.TRANSFER,
        );
        otherFeeInDoc = otherFeeInDoc.times(new Decimal(crossRateObj.rate));
      }

      const totalAmount = itemsSum
        .plus(logisticsFeeInDoc)
        .plus(otherFeeInDoc)
        .plus(Number(createPiDto.domesticTransportCost || 0))
        .plus(Number(createPiDto.portCharges || 0))
        .plus(Number(createPiDto.seaFreight || 0))
        .plus(Number(createPiDto.insuranceCost || 0));

      let exchangeRate = createPiDto.exchangeRate;
      if (!exchangeRate) {
        const rateObj = await this.currenciesService.getCrossRate(
          docCurrency,
          'VND',
          ExchangeRateType.TRANSFER,
        );
        exchangeRate = rateObj.rate;
      }

      const pi = this.piRepository.create({
        ...piRouteData,
        piNumber,
        exchangeRate,
        logisticsFee: logisticsFeeInDoc.toNumber(),
        logisticsFeeCurrency: createPiDto.logisticsFeeCurrency || docCurrency,
        otherFee: otherFeeInDoc.toNumber(),
        otherFeeCurrency: createPiDto.otherFeeCurrency || docCurrency,
        totalAmount: totalAmount.toNumber(),
        totalAmountVnd: totalAmount.times(new Decimal(exchangeRate)).toNumber(),
        createdByUsername: user.username,
        status: PIStatus.DRAFT,
      });

      const savedPi = (await queryRunner.manager.save(
        pi,
      )) as unknown as ProformaInvoice;

      const piItems = items.map((item) =>
        this.piItemsRepository.create({
          ...item,
          totalAmount: item.quantity * item.unitPrice,
        }),
      );

      for (const item of piItems) {
        item.proformaInvoiceId = savedPi._id;
        await queryRunner.manager.save(item);
      }

      if (piRouteData.quotationId) {
        await this.quotationsService.updateStatus(
          piRouteData.quotationId,
          QuotationStatus.CONVERTED,
        );
      }

      await queryRunner.commitTransaction();
      return this.findOne(savedPi._id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      await queryRunner.release();
    }
  }

  async createFromQuotation(dto: ConvertQuotationToPiDto, user: User) {
    const quotationId = dto.quotationId;
    if (!quotationId) throw new BadRequestException('Quotation ID is required');

    const quotation = await this.quotationsService.findOne(quotationId);

    // Phân tách rõ ràng các trường hợp lỗi logic
    if (quotation.status === QuotationStatus.CONVERTED) {
      throw new BadRequestException(
        `Báo giá ${quotation.quotationNumber} đã được chuyển đổi sang PI trước đó.`,
      );
    }

    if (
      quotation.status !== QuotationStatus.ACCEPTED &&
      quotation.status !== QuotationStatus.SENT
    ) {
      throw new BadRequestException(
        `Không thể chuyển đổi: Báo giá đang ở trạng thái "${quotation.status}". ` +
          `Yêu cầu trạng thái SENT (Đã gửi) hoặc ACCEPTED (Chấp nhận).`,
      );
    }

    // Tech Lead Logic: Validate Incoterm vs Logistics Fee
    const validation = validateIncotermLogisticsFee(quotation.incoterm, {
      logisticsFee: quotation.logisticsFee,
      seaFreight: quotation.seaFreight,
      insuranceCost: quotation.insuranceCost,
      domesticTransportCost: quotation.domesticTransportCost,
      portCharges: quotation.portCharges,
    });
    if (!validation.isValid) {
      throw new BadRequestException(
        `Lỗi từ Báo giá gốc: ${validation.message}`,
      );
    }

    const piDto: CreateProformaInvoiceDto = {
      customerId: quotation.customerId,
      quotationId: quotation._id,
      incoterm: dto.incoterm || quotation.incoterm,
      incotermLocation: dto.incotermLocation || quotation.incotermLocation,
      portOfLoading: dto.portOfLoading || quotation.portOfLoading,
      portOfLoading_port_id:
        dto.portOfLoading_port_id ||
        quotation.portOfLoading_port_id ||
        undefined,
      portOfDischarge: dto.portOfDischarge || quotation.portOfDischarge,
      portOfDischarge_port_id:
        dto.portOfDischarge_port_id ||
        quotation.portOfDischarge_port_id ||
        undefined,
      issueDate: dto.issueDate || new Date().toISOString(),
      currency: quotation.currency,
      exchangeRate: quotation.exchangeRate,
      paymentTerms: dto.paymentTerms || quotation.paymentTerms,
      note: dto.note || quotation.note,
      logisticsFee:
        dto.logisticsFee !== undefined
          ? dto.logisticsFee
          : quotation.logisticsFee || 0,
      logisticsFeeCurrency:
        dto.logisticsFeeCurrency || quotation.logisticsFeeCurrency || 'USD',
      otherFee:
        dto.otherFee !== undefined ? dto.otherFee : quotation.otherFee || 0,
      otherFeeCurrency:
        dto.otherFeeCurrency || quotation.otherFeeCurrency || 'USD',
      bankInfo: dto.bankInfo || quotation.bankInfo,
      domesticTransportCost:
        dto.domesticTransportCost !== undefined
          ? dto.domesticTransportCost
          : quotation.domesticTransportCost || 0,
      portCharges:
        dto.portCharges !== undefined
          ? dto.portCharges
          : quotation.portCharges || 0,
      seaFreight:
        dto.seaFreight !== undefined
          ? dto.seaFreight
          : quotation.seaFreight || 0,
      insuranceCost:
        dto.insuranceCost !== undefined
          ? dto.insuranceCost
          : quotation.insuranceCost || 0,
      depositAmount: dto.depositAmount || 0,
      depositPercent:
        dto.depositPercent !== undefined ? dto.depositPercent : 30,
      items: quotation.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        note: item.note,
      })),
    };

    return this.create(piDto, user);
  }

  async findAll(query: QueryParams) {
    const currentVal = query.current;
    const pageSizeVal = query.pageSize;
    const populateVal = query.populate;

    const current =
      typeof currentVal === 'string' || typeof currentVal === 'number'
        ? +currentVal
        : 1;
    const pageSize =
      typeof pageSizeVal === 'string' || typeof pageSizeVal === 'number'
        ? +pageSizeVal
        : 10;
    const skip = (current - 1) * pageSize;

    const filters: Record<string, unknown> = {};
    for (const key of Object.keys(query)) {
      if (key !== 'current' && key !== 'pageSize' && key !== 'populate') {
        filters[key] = query[key];
      }
    }

    const relations =
      typeof populateVal === 'string'
        ? populateVal.split(',')
        : ['customer', 'createdBy', 'quotation', 'salesContract'];

    const [results, total] = await this.piRepository.findAndCount({
      where: filters as FindOptionsWhere<ProformaInvoice>,
      relations,
      order: { createdAt: 'DESC' },
      take: pageSize,
      skip: skip,
    });

    return {
      results,
      meta: {
        current,
        pageSize,
        pages: Math.ceil(total / pageSize),
        total,
      },
    };
  }

  async findOne(id: string) {
    const pi = await this.piRepository.findOne({
      where: { _id: id },
      relations: [
        'customer',
        'createdBy',
        'quotation',
        'items',
        'items.product',
      ],
    });
    if (!pi) throw new NotFoundException('Proforma Invoice not found');
    return pi;
  }

  async update(id: string, updatePiDto: UpdateProformaInvoiceDto) {
    const pi = await this.findOne(id);
    if (!pi) throw new NotFoundException('Proforma Invoice not found');
    const hasPortOfLoadingPortId = 'portOfLoading_port_id' in updatePiDto;
    const hasPortOfLoading = 'portOfLoading' in updatePiDto;
    const hasPortOfDischargePortId = 'portOfDischarge_port_id' in updatePiDto;
    const hasPortOfDischarge = 'portOfDischarge' in updatePiDto;
    const routeData = await this.resolvePiPortsForUpdate({
      portOfLoading_port_id: updatePiDto.portOfLoading_port_id,
      portOfLoading: updatePiDto.portOfLoading,
      portOfDischarge_port_id: updatePiDto.portOfDischarge_port_id,
      portOfDischarge: updatePiDto.portOfDischarge,
      currentPortOfLoadingPortId: pi.portOfLoading_port_id,
      currentPortOfLoading: pi.portOfLoading,
      currentPortOfDischargePortId: pi.portOfDischarge_port_id,
      currentPortOfDischarge: pi.portOfDischarge,
      hasPortOfLoadingPortId,
      hasPortOfLoading,
      hasPortOfDischargePortId,
      hasPortOfDischarge,
    });
    Object.assign(pi, updatePiDto, routeData);
    return this.piRepository.save(pi);
  }

  async updateStatus(id: string, status: PIStatus, user?: User) {
    const pi = await this.findOne(id);
    if (!pi) throw new NotFoundException('Proforma Invoice not found');

    const validStatuses = [
      PIStatus.DRAFT,
      PIStatus.PENDING_APPROVAL,
      PIStatus.SENT,
      PIStatus.ACCEPTED,
      PIStatus.REJECTED,
      PIStatus.CANCELLED,
    ];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Trạng thái ${status} không hợp lệ cho Báo giá (PI). Vui lòng thực hiện tại Hợp đồng (Sales Contract).`,
      );
    }

    if (
      [PIStatus.SENT, PIStatus.PENDING_APPROVAL].includes(status) &&
      [PIStatus.DRAFT, PIStatus.REJECTED].includes(pi.status)
    ) {
      const amountVnd =
        Number(pi.totalAmountVnd || 0) ||
        (await this.currenciesService.convertToBase(
          Number(pi.totalAmount || 0),
          pi.currency,
        ));
      const matchingRule = await this.approvalMatrixService.findMatchingRule(
        ApprovalDocumentType.PROFORMA_INVOICE,
        amountVnd,
        pi.currency,
      );

      if (!matchingRule) {
        pi.status = PIStatus.SENT;
        pi.approvedByUsername = user?.username || pi.createdByUsername;
        pi.approvedAt = new Date();
        pi.rejectionReason = null;
        return this.piRepository.save(pi);
      }

      return this.dataSource.transaction(async (manager) => {
        const approvalRequest =
          await this.approvalMatrixService.createRequestInTransaction(
            manager,
            {
              ruleId: matchingRule._id,
              documentType: ApprovalDocumentType.PROFORMA_INVOICE,
              documentId: pi._id,
              documentNumber: pi.piNumber,
              title: `Approve Proforma Invoice ${pi.piNumber}`,
              currency: pi.currency,
              amount: Number(pi.totalAmount || 0),
              amountVnd,
              metadata: {
                customerId: pi.customerId,
                customerName: pi.customer?.name || null,
                quotationId: pi.quotationId,
                incoterm: pi.incoterm,
                source: 'proforma_invoices.updateStatus',
              },
            },
            user,
          );

        pi.status = PIStatus.PENDING_APPROVAL;
        pi.approvalWorkflowRequestId = approvalRequest?._id || null;
        pi.submittedForApprovalByUsername =
          user?.username || pi.createdByUsername;
        pi.submittedForApprovalAt = new Date();
        pi.approvedByUsername = null;
        pi.approvedAt = null;
        pi.rejectedByUsername = null;
        pi.rejectedAt = null;
        pi.rejectionReason = null;

        const savedPi = await manager.save(pi);
        return {
          ...savedPi,
          approvalRequest,
        };
      });
    }

    if (pi.status === PIStatus.PENDING_APPROVAL) {
      throw new BadRequestException('PI is already pending approval');
    }

    pi.status = status;
    return this.piRepository.save(pi);
  }

  async remove(id: string) {
    const pi = await this.findOne(id);
    return this.piRepository.softRemove(pi);
  }
}
