import { BeforeInsert, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SalesContract } from '@/modules/sales-contracts/entities/sales-contract.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Container } from './container.entity';
import { ColumnNumericTransformer } from '@/helpers/typeorm.util';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum ShipmentStatus {
  BOOKED = 'BOOKED',
  LOADING = 'LOADING',
  CUSTOMS_CLEARED = 'CUSTOMS_CLEARED',
  ON_BOARD = 'ON_BOARD',
  ARRIVED = 'ARRIVED',
  CLOSED = 'CLOSED'
}

@Entity('shipments')
export class Shipment {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('shp');
    }
  }

  @Column({ unique: true })
  shipmentNumber: string;

  @Column()
  salesContractId: string;

  @ManyToOne(() => SalesContract)
  @JoinColumn({ name: 'salesContractId' })
  salesContract: SalesContract;

  @Column({ type: 'enum', enum: ShipmentStatus, default: ShipmentStatus.BOOKED })
  status: ShipmentStatus;

  @Column({ default: false })
  isStockIssued: boolean;

  @Column({ type: 'timestamp', nullable: true })
  stockIssuedAt: Date;

  @Column({ nullable: true })
  bookingNumber: string;

  @Column({ nullable: true })
  shippingLine: string;

  @Column({ nullable: true })
  vesselName: string;

  @Column({ nullable: true })
  voyageNumber: string;

  @Column({ nullable: true })
  pol: string; // Port of Loading

  @Column({ nullable: true })
  pod: string; // Port of Discharge

  @Column({ type: 'timestamp', nullable: true })
  etd: Date; // Estimated Time of Departure

  @Column({ type: 'timestamp', nullable: true })
  eta: Date; // Estimated Time of Arrival

  @Column({ nullable: true })
  blNumber: string; // Bill of Lading

  @Column({ type: 'jsonb', nullable: true })
  documentChecklist: Record<string, 'PENDING' | 'DONE' | 'NA'>;

  @OneToMany(() => Container, (container) => container.shipment, { cascade: true })
  containers: Container[];

  // Logistics Costs (Mục 9 PRD)
  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  freightCost: number; // Cước biển/hàng không

  @Column({ type: 'varchar', default: 'USD' })
  freightCurrency: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  insuranceCost: number; // Phí bảo hiểm hàng hóa

  @Column({ type: 'varchar', default: 'USD' })
  insuranceCurrency: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  customsFeeVnd: number; // Phí khai báo hải quan

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  truckingCostVnd: number; // Phí vận chuyển nội địa (trucking)

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: new ColumnNumericTransformer() })
  localChargesVnd: number; // Phụ phí: THC, BAF, CAF, EBS...

  @Column({ nullable: true })
  logisticsPartnerId: string;

  @ManyToOne('Partner')
  @JoinColumn({ name: 'logisticsPartnerId' })
  logisticsPartner: any;

  @Column()
  createdByUsername: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdByUsername', referencedColumnName: 'username' })
  createdBy: User;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
