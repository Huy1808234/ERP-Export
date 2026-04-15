import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MenuItem } from '@/modules/menu.items/entities/menu.item.entity';

@Entity()
export class MenuItemOption {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  _id: string;

  @ManyToOne(() => MenuItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menuItemId' })
  menuItem: MenuItem;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  description: string;

  @Column({ type: 'float', default: 0 })
  additionalPrice: number;

  @Column({ type: 'varchar', nullable: true })
  optionalDescription: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
