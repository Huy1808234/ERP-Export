import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // e.g. "Create Product"

  @Column()
  apiPath: string; // e.g. "/api/v1/products"

  @Column()
  method: string; // GET, POST, PATCH, DELETE

  @Column()
  module: string; // e.g. "PRODUCTS"

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
