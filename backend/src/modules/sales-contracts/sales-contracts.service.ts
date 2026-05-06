import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { SalesContract, SalesContractStatus } from './entities/sales-contract.entity';
import { SalesContractItem } from './entities/sales-contract-item.entity';
import { InventoryService } from '../inventory/inventory.service';
import { IncotermsService } from './incoterms.service';
import { AccountingService } from '../accounting/accounting.service';
import { ProformaInvoice } from '../proforma-invoices/entities/proforma-invoice.entity';
import { InventoryTransactionType } from '../inventory/entities/inventory-ledger.entity';
import { Partner } from '../partners/entities/partner.entity';

@Injectable()
export class SalesContractsService {
  constructor(
    @InjectRepository(SalesContract)
    private contractRepository: Repository<SalesContract>,
    @InjectRepository(SalesContractItem)
    private contractItemRepository: Repository<SalesContractItem>,
    private dataSource: DataSource,
    private inventoryService: InventoryService,
    private incotermsService: IncotermsService,
    private accountingService: AccountingService,
  ) {}

  calculate(dto: any) {
    return this.incotermsService.calculateTotal(dto);
  }

  async create(dto: any, user: any) {
    const existing = await this.contractRepository.findOne({ where: { contractNumber: dto.contractNumber } });
    if (existing) {
      throw new ConflictException(`Số hợp đồng "${dto.contractNumber}" đã tồn tại trong hệ thống.`);
    }

    return this.dataSource.transaction(async (manager) => {
      const { items, ...data } = dto;
      
      const contract = manager.create(SalesContract, {
        ...data,
        status: SalesContractStatus.DRAFT,
      });

      const { totalAmount, totalAmountVnd } = this.incotermsService.calculateTotal({
        ...data,
        items
      });
      contract.totalAmount = totalAmount;
      contract.totalAmountVnd = totalAmountVnd;

      const saved = await manager.save(contract);

      if (items && items.length > 0) {
        const contractItems = items.map((item: any) => 
          manager.create(SalesContractItem, {
            ...item,
            salesContractId: saved.id
          })
        );
        for (const item of contractItems) {
          await manager.save(item);
        }
      }

      // Link PI to this contract if proformaInvoiceId is provided
      if (data.proformaInvoiceId) {
        await manager.update(ProformaInvoice, { id: data.proformaInvoiceId }, {
          salesContractId: saved.id
        });
      }

      return manager.findOne(SalesContract, {
        where: { id: saved.id },
        relations: ['buyer', 'items', 'items.product']
      });
    });
  }

  async findAll(query: any) {
    const { current = 1, pageSize = 10, ...filters } = query;
    const [results, total] = await this.contractRepository.findAndCount({
      where: filters,
      relations: ['buyer', 'items', 'items.product'],
      skip: (current - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' }
    });

    return {
      results,
      meta: {
        current,
        pageSize,
        pages: Math.ceil(total / pageSize),
        total
      }
    };
  }

  async findOne(id: string) {
    const contract = await this.contractRepository.findOne({
      where: { id },
      relations: ['buyer', 'items', 'items.product']
    });
    if (!contract) throw new NotFoundException('Contract not found');
    return contract;
  }

  async update(id: string, dto: any) {
    return this.dataSource.transaction(async (manager) => {
      const contract = await manager.findOne(SalesContract, { where: { id } });
      if (!contract) throw new NotFoundException('Contract not found');

      const { items, ...data } = dto;
      
      // Calculate new totals if items or base data changed
      const calculationInput = { ...contract, ...data };
      if (items) calculationInput.items = items;
      else calculationInput.items = await manager.find(SalesContractItem, { where: { salesContractId: id } });

      const { totalAmount, totalAmountVnd } = this.incotermsService.calculateTotal(calculationInput);
      
      Object.assign(contract, {
        ...data,
        totalAmount,
        totalAmountVnd
      });

      const saved = await manager.save(contract);

      // Handle items update
      if (items) {
        await manager.delete(SalesContractItem, { salesContractId: id });
        const contractItems = items.map((item: any) => 
          manager.create(SalesContractItem, {
            ...item,
            salesContractId: saved.id
          })
        );
        for (const item of contractItems) {
          await manager.save(item);
        }
      }

      // TECH LEAD SYNC: Update linked shipments if logistics info changed
      if (data.logisticsPartnerId || data.bookingNumber) {
        // We use query builder to update all shipments linked to this contract
        const updateData: any = {};
        if (data.logisticsPartnerId) updateData.logisticsPartnerId = data.logisticsPartnerId;
        if (data.bookingNumber) updateData.bookingNumber = data.bookingNumber;

        await manager.getRepository('Shipment').update({ salesContractId: id }, updateData);
      }

      return manager.findOne(SalesContract, {
        where: { id: saved.id },
        relations: ['buyer', 'items', 'items.product']
      });
    });
  }

  async confirmContract(id: string): Promise<SalesContract> {
    return this.dataSource.transaction(async (manager) => {
      // Senior Fix: Lock the root entity first without joins to avoid 'FOR UPDATE' join error
      const contract = await manager.findOne(SalesContract, {
        where: { id },
        lock: { mode: 'pessimistic_write' }
      });

      if (!contract) throw new NotFoundException(`Sales Contract not found`);
      
      // Load relations separately after lock is acquired
      contract.items = await manager.find(SalesContractItem, {
        where: { salesContractId: id }
      });
      if (contract.status !== SalesContractStatus.DRAFT) {
        throw new BadRequestException(`Chỉ có thể CONFIRM hợp đồng ở trạng thái DRAFT.`);
      }

      for (const item of contract.items) {
        await this.inventoryService.reserveStock(item.productId, item.quantity, contract.id, manager);
      }

      contract.status = SalesContractStatus.CONFIRMED;
      return manager.save(contract);
    });
  }

  async shipContract(id: string): Promise<SalesContract> {
    return this.dataSource.transaction(async (manager) => {
      // Senior Fix: Lock root first
      const contract = await manager.findOne(SalesContract, {
        where: { id },
        lock: { mode: 'pessimistic_write' }
      });

      if (!contract) throw new NotFoundException('Contract not found');

      // Load items and buyer separately
      contract.items = await manager.find(SalesContractItem, { where: { salesContractId: id } });
      contract.buyer = await manager.findOne(Partner, { where: { id: contract.buyerId } }) as any;
      
      if (contract.status !== SalesContractStatus.CONFIRMED) {
        throw new BadRequestException(`Phải duyệt (CONFIRM) hợp đồng trước khi xuất hàng (SHIP).`);
      }

      // NOTE: Inventory deduction is now handled at the Shipment level (issueStock)
      // shipContract now focuses purely on Accounting/Debt

      await this.accountingService.createJournalEntry({
        description: `Revenue Recognition: ${contract.contractNumber}`,
        referenceType: 'SALES_CONTRACT',
        referenceId: contract.id,
        items: [
          { accountCode: '131', debit: Number(contract.totalAmountVnd), credit: 0, partnerId: contract.buyerId }, 
          { accountCode: '511', debit: 0, credit: Number(contract.totalAmountVnd) } 
        ]
      }, manager);

      contract.status = SalesContractStatus.SHIPPED;
      return manager.save(contract);
    });
  }

  async cancelContract(id: string): Promise<SalesContract> {
    return this.dataSource.transaction(async (manager) => {
      // Senior Fix: Lock root first
      const contract = await manager.findOne(SalesContract, {
        where: { id },
        lock: { mode: 'pessimistic_write' }
      });

      if (!contract) throw new NotFoundException('Contract not found');

      // Load items
      contract.items = await manager.find(SalesContractItem, { where: { salesContractId: id } });
      
      if (contract.status === SalesContractStatus.CONFIRMED) {
        for (const item of contract.items) {
          await this.inventoryService.releaseStock(item.productId, item.quantity, contract.id, manager);
        }
      }

      contract.status = SalesContractStatus.CANCELLED;
      return manager.save(contract);
    });
  }
}
