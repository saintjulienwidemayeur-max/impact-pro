import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { ArtworkUploadsController, UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        storage: memoryStorage(),
        limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1, fields: 5, parts: 6 },
      }),
    }),
  ],
  controllers: [UploadsController, ArtworkUploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
