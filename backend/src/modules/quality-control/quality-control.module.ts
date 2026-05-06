import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityCheck } from './entities/quality-check.entity';
import { QualityControlService } from './quality-control.service';
import { QualityControlController } from './quality-control.controller';

@Module({
  imports: [TypeOrmModule.forFeature([QualityCheck])],
  providers: [QualityControlService],
  controllers: [QualityControlController],
  exports: [QualityControlService],
})
export class QualityControlModule {}
