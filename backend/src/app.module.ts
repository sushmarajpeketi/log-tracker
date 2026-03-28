import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LogsModule } from './logs/logs.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { LogInterceptor } from './common/interceptors/log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({ uri: config.get<string>('MONGO_URI') }),
      inject: [ConfigService],
    }),
    LogsModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LogInterceptor },
  ],
})
export class AppModule {}
