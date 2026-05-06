import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Product } from './src/modules/products/entities/product.entity';
import { Partner } from './src/modules/partners/entities/partner.entity';
import { Shipment } from './src/modules/shipments/entities/shipment.entity';
import { Repository } from 'typeorm';

async function checkDb() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const productRepo = app.get<Repository<Product>>(getRepositoryToken(Product));
  const partnerRepo = app.get<Repository<Partner>>(getRepositoryToken(Partner));
  const shipmentRepo = app.get<Repository<Shipment>>(getRepositoryToken(Shipment));

  const pCount = await productRepo.count();
  const paCount = await partnerRepo.count();
  const sCount = await shipmentRepo.count();

  console.log(`--- DB STATUS ---`);
  console.log(`Products: ${pCount}`);
  console.log(`Partners: ${paCount}`);
  console.log(`Shipments: ${sCount}`);
  
  await app.close();
}

checkDb();
