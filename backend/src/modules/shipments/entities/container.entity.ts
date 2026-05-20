import { BeforeInsert, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Shipment } from './shipment.entity';
import { createEntityId } from '@/common/ids/entity-id.util';

export enum ContainerType {
  C20DC = '20DC',
  C40DC = '40DC',
  C40HC = '40HC',
  C20RF = '20RF',
  C40RF = '40RF',
  LCL = 'LCL'
}

@Entity('containers')
export class Container {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('container');
    }
  }

  @Column()
  shipmentId: string;

  @ManyToOne(() => Shipment, (shipment) => shipment.containers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shipmentId' })
  shipment: Shipment;

  @Column({ nullable: true })
  containerNumber: string;

  @Column({ nullable: true })
  sealNumber: string;

  @Column({ type: 'enum', enum: ContainerType, default: ContainerType.C20DC })
  type: ContainerType;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  weightKg: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  cbm: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
