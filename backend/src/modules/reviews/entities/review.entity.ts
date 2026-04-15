import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Restaurant } from '@/modules/restaurants/entities/restaurant.entity';
import { User } from '@/modules/users/entities/user.entity';

@Entity()
export class Review {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  _id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurantId' })
  restaurant: Restaurant;

  @Column({ type: 'float', default: 0 })
  rating: number;

  @Column({ type: 'varchar', nullable: true })
  image: string | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
