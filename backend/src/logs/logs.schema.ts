import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LogDocument = Log & Document;

@Schema()
export class Log {
  @Prop({ required: true }) method: string;
  @Prop({ required: true }) url: string;
  @Prop({ required: true }) statusCode: number;
  @Prop({ required: true }) responseTime: number;
  @Prop({ type: Object, default: null }) requestBody: object | null;
  @Prop({ type: Object, required: true }) requestHeaders: object;
  @Prop({ type: Object, default: null }) responseBody: object | null;
  @Prop({ required: true }) ipAddress: string;
  @Prop({ required: true }) userAgent: string;
  @Prop({ required: true }) timestamp: Date;
  @Prop({ required: true }) level: string;
  @Prop({ required: true }) source: string;
  @Prop({ type: String, default: null }) userId: string | null;
  @Prop({ type: String, default: null }) userEmail: string | null;
}

export const LogSchema = SchemaFactory.createForClass(Log);

LogSchema.index({ timestamp: -1 });
LogSchema.index({ statusCode: 1 });
LogSchema.index({ method: 1 });
LogSchema.index({ userEmail: 1 });
LogSchema.index({ url: 'text', userAgent: 'text' });
