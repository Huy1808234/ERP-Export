import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';
import { RolePermissionAssignment } from './role-permission-assignment.entity';

@Entity('permissions')
export class Permission {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @Index()
  @Column()
  name: string; // e.g. "Create Product"

  @Column()
  apiPath: string; // e.g. "/api/v1/products"

  @Column()
  method: string; // GET, POST, PATCH, DELETE

  @Column()
  module: string; // e.g. "PRODUCTS"

  @OneToMany(
    () => RolePermissionAssignment,
    (assignment) => assignment.permission,
  )
  roleAssignments: RolePermissionAssignment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('perm');
    }
  }
}
