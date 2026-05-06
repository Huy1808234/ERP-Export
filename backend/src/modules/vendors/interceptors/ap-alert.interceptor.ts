import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class ApAlertInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ApAlertInterceptor.name);

  constructor(private readonly configService: ConfigService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap((response) => {
        const threshold = Number(this.configService.get('AP_ALERT_LIMIT'));
        if (!Number.isFinite(threshold) || threshold <= 0) return;

        const extractItems = (data: any): any[] => {
          if (!data) return [];
          if (Array.isArray(data)) return data;
          if (Array.isArray(data.results)) return data.results;
          return [data];
        };

        const items = extractItems(response?.data ?? response);
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const balance = Number(item.apBalance ?? item.currentApBalance ?? 0);
          if (Number.isFinite(balance) && balance > threshold) {
            this.logger.warn(
              `AP vuot nguong: vendor=${item.id ?? item.vendorId ?? 'unknown'} balance=${balance} limit=${threshold}`,
            );
          }
        }
      }),
    );
  }
}
