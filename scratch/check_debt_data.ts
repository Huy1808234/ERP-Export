
import { DataSource } from 'typeorm';
import { Partner } from './backend/src/modules/partners/entities/partner.entity';
import { ProformaInvoice } from './backend/src/modules/proforma-invoices/entities/proforma-invoice.entity';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

async function checkData() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [Partner, ProformaInvoice],
    synchronize: false,
  });

  await ds.initialize();
  
  console.log('--- PARTNERS ---');
  const partners = await ds.getRepository(Partner).find();
  partners.forEach(p => {
    console.log(`ID: ${p.id}, Name: ${p.name}, CurrentDebt: ${p.currentDebt}, Currency: ${p.defaultCurrency}`);
  });

  console.log('\n--- PROFORMA INVOICES ---');
  const pis = await ds.getRepository(ProformaInvoice).find({ relations: ['customer'] });
  pis.forEach(pi => {
    console.log(`PI: ${pi.piNumber}, Customer: ${pi.customer?.name}, Total: ${pi.totalAmount}, Deposit: ${pi.depositAmount}, Status: ${pi.status}`);
  });

  await ds.destroy();
}

checkData();
