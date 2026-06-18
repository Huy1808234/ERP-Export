import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Inquiry, InquiryStatus } from './entities/inquiry.entity';
import { Product } from '../products/entities/product.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class InquiriesService {
  private readonly logger = new Logger(InquiriesService.name);

  constructor(
    @InjectRepository(Inquiry)
    private inquiryRepo: Repository<Inquiry>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(data: any) {
    this.logger.log(`Creating new inquiry for customer: ${data.customerName}`);

    // Fetch product snapshot
    let productSnapshotName: string | null = null;
    let productSnapshotCode: string | null = null;
    if (data.productId) {
      const product = await this.productRepo.findOne({
        where: { _id: data.productId },
      });
      if (product) {
        productSnapshotName = product.vietnameseName || product.englishName;
        productSnapshotCode = product.sku;
      }
    }

    const inquiry = this.inquiryRepo.create({
      ...data,
      productSnapshotName,
      productSnapshotCode,
      status: InquiryStatus.PENDING,
    });

    const savedInquiry = (await this.inquiryRepo.save(
      inquiry,
    )) as any as Inquiry;
    this.logger.log(
      `Inquiry saved with ID: ${savedInquiry._id}. Emitting notification event...`,
    );

    // Senior Approach: Decouple notification logic using Event Emitter
    this.eventEmitter.emit('notification.new_inquiry', {
      id: savedInquiry._id,
      customerName: savedInquiry.customerName,
      customerEmail: savedInquiry.customerEmail,
      quantity: savedInquiry.quantity,
      message: `Yêu cầu báo giá mới từ ${savedInquiry.customerName}`,
    });

    return savedInquiry;
  }

  async findAll(query: any = {}) {
    const { status, current = 1, pageSize = 10, search } = query;
    const skip = (Number(current) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const queryBuilder = this.inquiryRepo
      .createQueryBuilder('inquiry')
      .leftJoinAndSelect('inquiry.product', 'product')
      .orderBy('inquiry.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    if (status) {
      queryBuilder.andWhere('inquiry.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere(
        '(LOWER(inquiry.customerName) LIKE LOWER(:search) OR LOWER(inquiry.customerEmail) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      current: Number(current),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / Number(pageSize)),
    };
  }

  async updateStatus(id: string, status: InquiryStatus) {
    const inquiry = await this.inquiryRepo.findOne({ where: { _id: id } });
    if (!inquiry) {
      throw new NotFoundException('Inquiry not found');
    }

    inquiry.status = status;
    return this.inquiryRepo.save(inquiry);
  }

  async remove(id: string) {
    const inquiry = await this.inquiryRepo.findOne({ where: { _id: id } });
    if (!inquiry) {
      throw new NotFoundException('Inquiry not found');
    }

    const result = await this.inquiryRepo.softDelete({ _id: id });
    this.eventEmitter.emit('notification.unread_count', {
      count: await this.countUnread(),
    });
    return { id, affected: result.affected ?? 0 };
  }

  async bulkRemove(ids: string[]) {
    const normalizedIds = Array.isArray(ids)
      ? ids.map((id) => String(id).trim()).filter(Boolean)
      : [];

    if (!normalizedIds.length) {
      throw new BadRequestException('No inquiry ids were provided');
    }

    const existingCount = await this.inquiryRepo.count({
      where: { _id: In(normalizedIds) },
    });
    if (!existingCount) {
      throw new NotFoundException('No matching inquiries were found');
    }

    const result = await this.inquiryRepo.softDelete({
      _id: In(normalizedIds),
    });
    this.eventEmitter.emit('notification.unread_count', {
      count: await this.countUnread(),
    });
    return { requested: normalizedIds.length, deleted: result.affected ?? 0 };
  }

  async countUnread(): Promise<number> {
    return this.inquiryRepo.count({ where: { isRead: false } });
  }

  async markAsRead(id: string) {
    const result = await this.inquiryRepo.update({ _id: id }, { isRead: true });
    const unreadCount = await this.countUnread();
    // Broadcast updated count to all connected admin clients
    this.eventEmitter.emit('notification.unread_count', { count: unreadCount });
    return result;
  }

  async markAllAsRead() {
    const result = await this.inquiryRepo.update(
      { isRead: false },
      { isRead: true },
    );
    this.eventEmitter.emit('notification.unread_count', { count: 0 });
    return result;
  }

  async findUnread(limit = 7) {
    return this.inquiryRepo.find({
      where: { isRead: false },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['product'],
    });
  }
}
