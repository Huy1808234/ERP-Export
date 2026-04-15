import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Restaurant } from './entities/restaurant.entity';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(Restaurant)
    private restaurantRepository: Repository<Restaurant>,
  ) {}

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  async create(createRestaurantDto: CreateRestaurantDto) {
    const newRestaurant = this.restaurantRepository.create(createRestaurantDto);
    const savedRestaurant = await this.restaurantRepository.save(newRestaurant);
    return savedRestaurant;
  }

  async findAll() {
    return await this.restaurantRepository.find();
  }

  async findOne(id: string) {
    if (!this.isValidUUID(id)) throw new BadRequestException(`ID không hợp lệ: ${id}`);
    const restaurant = await this.restaurantRepository.findOneBy({ _id: id });
    if (!restaurant) throw new NotFoundException(`Không tìm thấy nhà hàng`);
    return restaurant;
  }

  async update(id: string, updateRestaurantDto: UpdateRestaurantDto) {
    if (!this.isValidUUID(id)) throw new BadRequestException(`ID không hợp lệ: ${id}`);
    
    await this.restaurantRepository.update({ _id: id }, updateRestaurantDto);
    const updatedRestaurant = await this.restaurantRepository.findOneBy({ _id: id });
    
    if (!updatedRestaurant) throw new NotFoundException(`Không tìm thấy nhà hàng`);
    
    return {
      message: 'Cập nhật thành công',
      data: updatedRestaurant
    };
  }

  async remove(id: string) {
    if (!this.isValidUUID(id)) throw new BadRequestException(`ID không hợp lệ: ${id}`);
    
    const result = await this.restaurantRepository.delete({ _id: id });
    if (result.affected === 0) throw new NotFoundException(`Không tìm thấy nhà hàng`);

    return {
      message: 'Đã xóa nhà hàng thành công',
      deletedCount: result.affected
    };
  }
}
