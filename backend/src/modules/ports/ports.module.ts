import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Port } from './entities/port.entity';
import { PortsController } from './ports.controller';
import { PortsService } from './ports.service';
import { CountriesModule } from '../countries/countries.module';

@Module({
  imports: [TypeOrmModule.forFeature([Port]), CountriesModule],
  controllers: [PortsController],
  providers: [PortsService],
  exports: [PortsService],
})
export class PortsModule {}
