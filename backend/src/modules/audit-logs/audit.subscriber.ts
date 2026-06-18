import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  constructor(private dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  private getEntityRef(entity: any, fallback: any = 'unknown') {
    if (!entity) {
      return String(fallback ?? 'unknown');
    }

    return String(entity._id ?? entity.id ?? fallback ?? 'unknown');
  }

  async afterInsert(event: InsertEvent<any>) {
    if (event.metadata.tableName === 'audit_logs') return;

    const auditLog = this.dataSource.manager.create(AuditLog, {
      tableName: event.metadata.tableName,
      recordId: this.getEntityRef(event.entity),
      action: 'INSERT',
      newValues: event.entity,
      username: 'system',
    });
    await this.dataSource.manager.save(AuditLog, auditLog);
  }

  async afterUpdate(event: UpdateEvent<any>) {
    if (event.metadata.tableName === 'audit_logs') return;

    const oldValues = event.databaseEntity;
    const newValues = event.entity;

    const auditLog = this.dataSource.manager.create(AuditLog, {
      tableName: event.metadata.tableName,
      recordId: this.getEntityRef(
        event.entity,
        this.getEntityRef(event.databaseEntity),
      ),
      action: 'UPDATE',
      oldValues,
      newValues,
      username: 'system',
    });
    await this.dataSource.manager.save(AuditLog, auditLog);
  }

  async afterRemove(event: RemoveEvent<any>) {
    if (event.metadata.tableName === 'audit_logs') return;

    const auditLog = this.dataSource.manager.create(AuditLog, {
      tableName: event.metadata.tableName,
      recordId: this.getEntityRef(event.databaseEntity, event.entityId),
      action: 'DELETE',
      oldValues: event.databaseEntity,
      username: 'system',
    });
    await this.dataSource.manager.save(AuditLog, auditLog);
  }
}
