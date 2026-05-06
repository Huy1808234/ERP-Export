import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartnersModule } from './modules/partners/partners.module';
import { ProductsModule } from './modules/products/products.module';
import { AuthModule } from './auth/auth.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { ProformaInvoicesModule } from './modules/proforma-invoices/proforma-invoices.module';
import { ShipmentsModule } from './modules/shipments/shipments.module';
import { PurchaseRequestsModule } from './modules/purchase-requests/purchase-requests.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { GoodsReceiptsModule } from './modules/goods-receipts/goods-receipts.module';
import { VendorInvoicesModule } from './modules/vendor-invoices/vendor-invoices.module';
import { JwtAuthGuard } from './auth/passport/jwt-auth.guard';
import { RolesGuard } from './auth/passport/roles.guard';
import { PermissionsGuard } from './auth/passport/permissions.guard';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core/constants';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { TransformInterceptor } from './core/transform.interceptor';
import { PurchaseReturnsModule } from './modules/purchase-returns/purchase-returns.module';
import { TradeFinanceModule } from './modules/trade-finance/trade-finance.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { LandingModule } from './modules/landing/landing.module';
import { CurrenciesModule } from './modules/currencies/currencies.module';
import { RolesModule } from './modules/roles/roles.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SalesContractsModule } from './modules/sales-contracts/sales-contracts.module';
import { ExportDocumentsModule } from './modules/export-documents/export-documents.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { BullModule } from '@nestjs/bullmq';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { LotsModule } from './modules/lots/lots.module';
import { QualityControlModule } from './modules/quality-control/quality-control.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', '127.0.0.1'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('POSTGRES_HOST'),
        port: configService.get<number>('POSTGRES_PORT'),
        username: configService.get<string>('POSTGRES_USER'),
        password: configService.get<string>('POSTGRES_PASSWORD'),
        database: configService.get<string>('POSTGRES_DATABASE'),
        autoLoadEntities: true,
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: 'smtp.gmail.com',
          port: 465,
          auth: {
            user: configService.get<string>('MAIL_USER'),
            pass: configService.get<string>('MAIL_PASSWORD'),
          },
        },
        defaults: {
          from: '"No Reply" <no-reply@localhost>',
        },
        template: {
          dir: process.cwd() + '/src/mail/templates/',
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
    // Business Modules
    UsersModule,
    AuthModule,
    PartnersModule,
    ProductsModule,
    QuotationsModule,
    ProformaInvoicesModule,
    PurchaseRequestsModule,
    PurchaseOrdersModule,
    GoodsReceiptsModule,
    VendorInvoicesModule,
    PurchaseReturnsModule,
    TradeFinanceModule,
    AccountingModule,
    ShipmentsModule,
    LandingModule,
    CurrenciesModule,
    RolesModule,
    InventoryModule,
    SalesContractsModule,
    ExportDocumentsModule,
    DashboardsModule,
    AuditLogsModule,
    ApprovalsModule,
    LotsModule,
    QualityControlModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    }
  ],
})
export class AppModule {}
