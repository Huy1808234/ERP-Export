import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContainerType } from '../entities/container.entity';

export enum ContainerTypeEnum {
  DC_20 = '20DC',
  HC_40 = '40HC',
  DC_40 = '40DC',
  RF_20 = '20RF',
  RF_40 = '40RF',
  LCL = 'LCL',
}

export class CreateContainerDto {
  @IsEnum(ContainerType)
  @IsOptional()
  type?: ContainerType;

  @IsEnum(ContainerTypeEnum)
  @IsOptional()
  containerType?: ContainerTypeEnum;

  @IsString()
  @IsOptional()
  containerNumber?: string;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  weightKg?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  grossWeightKg?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  cbm?: number;

  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  volumeCbm?: number;

  @IsString()
  @IsOptional()
  sealNumber?: string;
}
