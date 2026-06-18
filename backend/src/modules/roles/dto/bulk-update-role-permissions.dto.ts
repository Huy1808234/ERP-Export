import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PermissionDataScope } from '@/common/auth/permission-scope';

export class PermissionScopeAssignmentDto {
  @IsString()
  @IsNotEmpty()
  permission_ref: string;

  @IsEnum(PermissionDataScope)
  @IsOptional()
  scope?: PermissionDataScope;
}

export class RolePermissionAssignmentDto {
  @IsString()
  @IsNotEmpty()
  role_ref: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permission_refs?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionScopeAssignmentDto)
  @IsOptional()
  permission_assignments?: PermissionScopeAssignmentDto[];
}

export class BulkUpdateRolePermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RolePermissionAssignmentDto)
  assignments: RolePermissionAssignmentDto[];
}
