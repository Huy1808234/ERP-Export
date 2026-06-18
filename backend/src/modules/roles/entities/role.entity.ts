import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Permission } from './permission.entity';
import { User } from '../../users/entities/user.entity';
import { createEntityId } from '@/common/ids/entity-id.util';
import { RolePermissionAssignment } from './role-permission-assignment.entity';

@Entity('roles')
export class Role {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @Index({ unique: true })
  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToMany(() => Permission)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'roleRef', referencedColumnName: '_id' },
    inverseJoinColumn: { name: 'permissionRef', referencedColumnName: '_id' },
  })
  permissions: Permission[];

  @OneToMany(() => RolePermissionAssignment, (assignment) => assignment.role)
  permissionAssignments: RolePermissionAssignment[];

  @OneToMany(() => User, (user) => user.role)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('role');
    }
  }
}
