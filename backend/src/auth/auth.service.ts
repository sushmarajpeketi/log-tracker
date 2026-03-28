import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/users.schema';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string, res: Response): Promise<{ email: string }> {
    const { email: lowerEmail, userId } = await this.usersService.create(email, password);
    this.setAuthCookie(res, userId, lowerEmail);
    return { email: lowerEmail };
  }

  async login(email: string, password: string, res: Response): Promise<{ email: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, (user as UserDocument).passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    this.setAuthCookie(res, (user._id as Types.ObjectId).toString(), (user as UserDocument).email);
    return { email: (user as UserDocument).email };
  }

  logout(res: Response): void {
    const secure = process.env.NODE_ENV === 'production';
    res.clearCookie('jwt', { httpOnly: true, sameSite: 'lax', secure });
  }

  private setAuthCookie(res: Response, userId: string, email: string): void {
    const token = this.jwtService.sign({ sub: userId, email });
    const secure = process.env.NODE_ENV === 'production';
    res.cookie('jwt', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
