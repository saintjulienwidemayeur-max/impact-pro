import { Controller, Get, HttpCode, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { envSchema } from '../config/env';
import { uploadThrottle } from '../common/throttle-limits';
import { UploadsService, type UploadView } from './uploads.service';

const fileBody = { schema: { type: 'object' as const, required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } };

/** Per-route multer limits, resolved from the (boot-validated) environment. */
function limits(key: 'UPLOAD_MAX_BYTES' | 'UPLOAD_ARTWORK_MAX_BYTES') {
  return { storage: memoryStorage(), limits: { fileSize: envSchema.shape[key].parse(process.env[key]), files: 1, fields: 5, parts: 6 } };
}

async function send(uploads: UploadsService, id: string, res: Response): Promise<void> {
  const { upload, stream } = await uploads.open(id);
  const isPdf = upload.mimeType === 'application/pdf';
  const filename = encodeURIComponent(upload.originalName);
  res.status(200);
  res.setHeader('Content-Type', upload.mimeType);
  res.setHeader('Content-Length', String(upload.size));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `${isPdf ? 'attachment' : 'inline'}; filename*=UTF-8''${filename}`);
  // Uploads are immutable (new file → new id), so they can be cached for a long time.
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('ETag', `"${upload.sha256}"`);
  // Allow the storefront (another origin) to display the file in <img>.
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

@ApiTags('uploads')
@Controller({ path: 'uploads/logos', version: '1' })
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @HttpCode(201)
  @Throttle(uploadThrottle)
  @UseInterceptors(FileInterceptor('file', limits('UPLOAD_MAX_BYTES')))
  @ApiOperation({ summary: 'Upload a logo (PNG, JPEG, WEBP or PDF, ≤ 10 MB). Type is verified from file contents; SVG is rejected.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @ApiCreatedResponse({ description: '{ data: { id, url, mimeType, size, originalName, width?, height? } }' })
  create(@UploadedFile() file: Express.Multer.File | undefined): Promise<UploadView> {
    return this.uploads.createLogo(file);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Download a previously uploaded logo' })
  @ApiOkResponse({ description: 'The raw file bytes' })
  @ApiNotFoundResponse({ description: 'Unknown upload id' })
  download(@Param('id') id: string, @Res() res: Response): Promise<void> {
    return send(this.uploads, id, res);
  }
}

@ApiTags('uploads')
@Controller({ path: 'uploads/artwork', version: '1' })
export class ArtworkUploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @HttpCode(201)
  @Throttle(uploadThrottle)
  @UseInterceptors(FileInterceptor('file', limits('UPLOAD_ARTWORK_MAX_BYTES')))
  @ApiOperation({
    summary: 'Upload a ready-to-print artwork file (PNG, JPEG, WEBP or PDF, ≤ UPLOAD_ARTWORK_MAX_BYTES, default 25 MB)',
    description: 'Type is verified from file contents; SVG is rejected.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody)
  @ApiCreatedResponse({ description: '{ data: { id, url, mimeType, size, originalName, width?, height? } }' })
  create(@UploadedFile() file: Express.Multer.File | undefined): Promise<UploadView> {
    return this.uploads.createArtwork(file);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Download a previously uploaded artwork file' })
  @ApiOkResponse({ description: 'The raw file bytes' })
  @ApiNotFoundResponse({ description: 'Unknown upload id' })
  download(@Param('id') id: string, @Res() res: Response): Promise<void> {
    return send(this.uploads, id, res);
  }
}
