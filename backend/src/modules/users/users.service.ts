import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { hashPasswordHelper } from '@/helpers/util';
import aqp from 'api-query-params';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { MailerService } from '@nestjs-modules/mailer';
@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<User>,
    private mailerService: MailerService,
  ) {}

  //  Chỉ trả về true/false, KHÔNG throw error ở đây
  isEmailExist = async (email: string) => {
    const user = await this.userModel.exists({ email });
    if (user) {
      return true;
    }
    return false;
  };

  async create(createUserDto: CreateUserDto) {
    const { name, email, password, phone, address, image } = createUserDto;

    // 2. Kiểm tra email
    const isExist = await this.isEmailExist(email);
    if (isExist) {
      // Lúc này BadRequestException mới chính thức được gọi nè!
      throw new BadRequestException(
        `Email đã tồn tại: ${email}. Vui lòng sử dụng email khác.`,
      );
    }

    // 3. Hash password
    const hashPassword = await hashPasswordHelper(password);

    // 4. Lưu vào database
    const user = await this.userModel.create({
      name,
      email,
      password: hashPassword,
      phone,
      address,
      image,
    });

    return {
      _id: user._id,
    };
  }

  async findAll(query: string, current: number, pageSize: number) {
    const { filter, sort } = aqp(query);
    if (filter.current) delete filter.current;
    if (filter.pageSize) delete filter.pageSize;
    if (filter.limit) delete filter.limit;

    if (!current) current = 1;
    if (!pageSize) pageSize = 10;

    const totalItems = (await this.userModel.find(filter)).length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const skip = (current - 1) * pageSize;

    const results = await this.userModel
      .find(filter)
      .limit(pageSize)
      .skip(skip)
      .select('-password') // Ẩn trường password khi trả về kết quả
      .sort(sort as any);

    return { results, totalPages };
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  async findByEmail(email: string) {
    return await this.userModel.findOne({ email });
  }

  async findByName(name: string) {
    return await this.userModel.findOne({ name });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    // 1. Validate ID
    if (!mongoose.isValidObjectId(id)) {
      throw new BadRequestException(`ID không hợp lệ: ${id}`);
    }

    // 2. Remove _id khỏi data
    const { _id, ...updateData } = updateUserDto;

    // 3. Update
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      {
        new: true, // trả về dữ liệu sau khi update
        runValidators: true, // chạy validation schema
      },
    );

    // 4. Check tồn tại
    if (!user) {
      throw new NotFoundException(`User không tồn tại`);
    }

    // 5. Response clean
    return {
      message: 'Cập nhật user thành công',
      data: user,
    };
  }

  async remove(id: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new BadRequestException(`ID không hợp lệ: ${id}`);
    }

    const result = await this.userModel.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      throw new NotFoundException(`Không tìm thấy user với id: ${id}`);
    }

    return {
      message: 'Xoá user thành công',
      deletedCount: result.deletedCount,
    };
  }

  async handleRegister(createUserDto: CreateUserDto) {
    const { name, email, password } = createUserDto;

    //Kiểm tra email
    const isExist = await this.isEmailExist(email);
    if (isExist) {
      // Lúc này BadRequestException mới chính thức được gọi nè!
      throw new BadRequestException(
        `Email đã tồn tại: ${email}. Vui lòng sử dụng email khác.`,
      );
    }
    // Hash password
    const hashPassword = await hashPasswordHelper(password);
    const codeId = uuidv4();
    // Lưu vào database
    const user = await this.userModel.create({
      name,
      email,
      password: hashPassword,
      isActive: false,
      codeId: codeId, // Tạo codeId bằng uuidv4
      codeExpired: dayjs().add(5, 'minutes').toDate(), // Code hết hạn sau 5 phút
    });
    //send email
    this.mailerService.sendMail({
      to: user.email, // list of receivers
      subject: 'Kích hoạt tài khoản amit group ✔', // Subject line
      template: 'register',
      context: {
        name : user?.name ?? user.email,
        activationCode: user.codeId,
      },
    });
    //trả ra phản hồi
    return {
      _id: user._id,
    };
  }
}
 