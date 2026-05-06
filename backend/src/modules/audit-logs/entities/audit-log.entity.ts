import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @Column({ nullable: true })
  userId: string; // ID của người thực hiện hành động

  @CreateDateColumn()
  createdAt: Date;
}
