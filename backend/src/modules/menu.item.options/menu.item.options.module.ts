import { Module } from '@nestjs/common';
import { MenuItemOptionsService } from './menu.item.options.service';
import { MenuItemOptionsController } from './menu.item.options.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItemOption } from './entities/menu.item.option.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MenuItemOption])],
  controllers: [MenuItemOptionsController],
  providers: [MenuItemOptionsService],
})
export class MenuItemOptionsModule {}
