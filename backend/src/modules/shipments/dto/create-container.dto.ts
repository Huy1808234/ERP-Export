import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
} from 'class-validator';
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
  @IsEnum(ContainerTypeEnum)
  containerType: ContainerTypeEnum;

  @IsString()
  @IsOptional()
  containerNumber?: string;

  @IsNumber()
  @IsOptional()
  quantity?: number;

  @IsNumber()
  @IsOptional()
  grossWeightKg?: number;

  @IsNumber()
  @IsOptional()
  volumeCbm?: number;

  @IsString()
  @IsOptional()
  sealNumber?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
