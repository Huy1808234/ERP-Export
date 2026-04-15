import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';
import { User } from '@/modules/users/entities/user.entity';

@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  _id: string;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', default: 'PENDING' })
  status: string;

  @Column({ type: 'float', default: 0 })
  totalPrice: number;

  @Column({ type: 'timestamp', nullable: true })
  orderTime: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  deliveryTime: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
