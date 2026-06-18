import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { PermissionDataScope } from '@/common/auth/permission-scope';
import { Permission } from './permission.entity';
import { Role } from './role.entity';

@Entity('role_permissions')
@Index(['roleRef', 'permissionRef'], { unique: true })
export class RolePermissionAssignment {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  roleRef: string;

  @PrimaryColumn({ type: 'varchar', length: 40 })
  permissionRef: string;

  @Column({ type: 'varchar', length: 20, default: PermissionDataScope.ALL })
  scope: PermissionDataScope;

  @ManyToOne(() => Role, (role) => role.permissionAssignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roleRef', referencedColumnName: '_id' })
  role: Role;

  @ManyToOne(() => Permission, (permission) => permission.roleAssignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'permissionRef', referencedColumnName: '_id' })
  permission: Permission;
}
