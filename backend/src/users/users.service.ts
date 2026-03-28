import { Injectable, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './users.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async create(email: string, password: string): Promise<{ email: string; userId: string }> {
    const normalizedEmail = email.toLowerCase();
    const existing = await this.userModel.findOne({ email: normalizedEmail });
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const user = await this.userModel.create({ email: normalizedEmail, passwordHash });
      return { email: normalizedEmail, userId: (user._id as Types.ObjectId).toString() };
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException('Email already registered');
      throw err;
    }
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  async findAll(): Promise<{ email: string }[]> {
    return this.userModel.find({}, { email: 1, _id: 0 }).sort({ email: 1 }).lean();
  }
}
