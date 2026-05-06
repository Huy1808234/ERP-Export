import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent, RemoveEvent } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  constructor(private dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  async afterInsert(event: InsertEvent<any>) {
    if (event.metadata.tableName === 'audit_logs') return;
    
    const auditLog = this.dataSource.manager.create(AuditLog, {
      tableName: event.metadata.tableName,
      recordId: event.entity?.id || 'unknown',
      action: 'INSERT',
      newValues: event.entity,
      userId: 'SYSTEM'
    });
    await this.dataSource.manager.save(AuditLog, auditLog);
  }

  async afterUpdate(event: UpdateEvent<any>) {
    if (event.metadata.tableName === 'audit_logs') return;
    
    const oldValues = event.databaseEntity;
    const newValues = event.entity;
    
    const auditLog = this.dataSource.manager.create(AuditLog, {
      tableName: event.metadata.tableName,
      recordId: event.entity?.id || event.databaseEntity?.id || 'unknown',
      action: 'UPDATE',
      oldValues,
      newValues,
      userId: 'SYSTEM'
    });
    await this.dataSource.manager.save(AuditLog, auditLog);
  }

  async afterRemove(event: RemoveEvent<any>) {
    if (event.metadata.tableName === 'audit_logs') return;
    
    const auditLog = this.dataSource.manager.create(AuditLog, {
      tableName: event.metadata.tableName,
      recordId: event.entityId || 'unknown',
      action: 'DELETE',
      oldValues: event.databaseEntity,
      userId: 'SYSTEM'
    });
    await this.dataSource.manager.save(AuditLog, auditLog);
  }
}
