import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from '@/modules/orders/entities/order.entity';
import { Menu } from '@/modules/menus/entities/menu.entity';
import { MenuItem } from '@/modules/menu.items/entities/menu.item.entity';
import { MenuItemOption } from '@/modules/menu.item.options/entities/menu.item.option.entity';

@Entity()
export class OrderDetail {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  _id: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @ManyToOne(() => Menu, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menuId' })
  menu: Menu;

  @ManyToOne(() => MenuItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menuItemId' })
  menuItem: MenuItem;

  @ManyToOne(() => MenuItemOption, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menuItemOptionId' })
  menuItemOption: MenuItemOption | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
