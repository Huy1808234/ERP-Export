import { BeforeInsert, Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { createEntityId } from '@/common/ids/entity-id.util';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryColumn({ type: 'varchar', length: 40, name: '_id' })
  _id: string;

  @Column()
  tableName: string;

  @Column()
  recordId: string;

  @Column()
  action: 'INSERT' | 'UPDATE' | 'DELETE';

  @Column({ type: 'jsonb', nullable: true })
  oldValues: any;

  @Column({ type: 'jsonb', nullable: true })
  newValues: any;

  @Column({ type: 'varchar', nullable: true })
  username: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  assignId() {
    if (!this._id) {
      this._id = createEntityId('audit');
    }
  }
}
