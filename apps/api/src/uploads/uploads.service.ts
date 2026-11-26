import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { UploadPurpose, type Upload } from '@prisma/client';
import { imageSize } from 'image-size';
import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService, StoredObjectMissingError } from '../storage/storage.service';
import { detectLogoType, sanitizeFilename } from './file-signature';

export interface UploadView {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  originalName: string;
  width?: number;
  height?: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function logoUrl(id: string): string {
  return `/api/v1/uploads/logos/${id}`;
}

export function artworkUrl(id: string): string {
  return `/api/v1/uploads/artwork/${id}`;
}

/** Public (relative) URL of an upload, according to what it was uploaded as. */
export function uploadUrl(id: string, purpose: UploadPurpose): string {
  return purpose === UploadPurpose.ARTWORK ? artworkUrl(id) : logoUrl(id);
}

type IncomingFile = { buffer: Buffer; originalname?: string; size: number } | undefined;

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  createLogo(file: IncomingFile): Promise<UploadView> {
    return this.create(file, UploadPurpose.LOGO);
  }

  createArtwork(file: IncomingFile): Promise<UploadView> {
    return this.create(file, UploadPurpose.ARTWORK);
  }

  private async create(file: IncomingFile, purpose: UploadPurpose): Promise<UploadView> {
    if (!file || !file.buffer || file.size === 0) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'A non-empty file is required in the "file" field',
        details: [{ field: 'file', message: 'required' }],
      });
    }
    const mimeType = detectLogoType(file.buffer);
    if (!mimeType) {
      throw new UnprocessableEntityException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: 'Only PNG, JPEG, WEBP or PDF files are accepted',
      });
    }

    let width: number | null = null;
    let height: number | null = null;
    if (mimeType !== 'application/pdf') {
      try {
        const dim = imageSize(file.buffer);
        width = dim.width ?? null;
        height = dim.height ?? null;
      } catch {
        throw new UnprocessableEntityException({ code: 'CORRUPT_IMAGE', message: 'The image could not be read' });
      }
    }

    const id = randomUUID();
    const storageKey = `${purpose === UploadPurpose.ARTWORK ? 'artwork' : 'logos'}/${id}`;
    await this.storage.put(storageKey, file.buffer, mimeType);
    const upload = await this.prisma.upload.create({
      data: {
        id,
        storageKey,
        storageDriver: this.storage.driver,
        originalName: sanitizeFilename(file.originalname),
        mimeType,
        size: file.buffer.length,
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
        width,
        height,
        purpose,
      },
    });
    return this.toView(upload);
  }

  async open(id: string): Promise<{ upload: Upload; stream: Readable }> {
    if (!UUID_RE.test(id)) throw this.notFound();
    const upload = await this.prisma.upload.findUnique({ where: { id } });
    if (!upload) throw this.notFound();
    try {
      return { upload, stream: await this.storage.get(upload.storageKey) };
    } catch (err) {
      if (err instanceof StoredObjectMissingError) throw this.notFound();
      throw err;
    }
  }

  toView(u: Upload): UploadView {
    return {
      id: u.id,
      url: uploadUrl(u.id, u.purpose),
      mimeType: u.mimeType,
      size: u.size,
      originalName: u.originalName,
      ...(u.width != null && u.height != null ? { width: u.width, height: u.height } : {}),
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ code: 'UPLOAD_NOT_FOUND', message: 'Upload not found' });
  }
}
