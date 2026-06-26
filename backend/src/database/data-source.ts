import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

import { Inquiry } from '../modules/inquiries/entities/inquiry.entity';
import { PortalNotification } from '../modules/portal/entities/portal-notification.entity';
import { PortalPaymentReceipt } from '../modules/portal/entities/portal-payment-receipt.entity';
import { PortalSupportMessage } from '../modules/portal/entities/portal-support-message.entity';
import { PortalSupportTicket } from '../modules/portal/entities/portal-support-ticket.entity';
import { SepayTransaction } from '../modules/sepay/entities/sepay-transaction.entity';
import { ContractSignatureInvitation } from '../modules/sales-contracts/entities/contract-signature-invitation.entity';

export const migrationEntities = [
  Inquiry,
  PortalNotification,
  PortalPaymentReceipt,
  PortalSupportMessage,
  PortalSupportTicket,
  SepayTransaction,
  ContractSignatureInvitation,
];

export const dataSourceOptions: DataSourceOptions & TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DATABASE,
  entities: [...migrationEntities, 'src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  migrationsRun: false,
  synchronize: false,
  logging: ['error', 'warn'],
  autoLoadEntities: true,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
