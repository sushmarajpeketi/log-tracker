import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Log, LogSchema } from './logs.schema';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Log.name, schema: LogSchema }])],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [MongooseModule],
})
export class LogsModule {}
