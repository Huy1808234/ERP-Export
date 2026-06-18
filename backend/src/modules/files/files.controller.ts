import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createOpaqueCode } from '@/common/ids/entity-id.util';
import { User } from '@/decorator/customize';
import { User as UserEntity } from '@/modules/users/entities/user.entity';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { extname, relative, resolve } from 'path';
import { FilesService } from './files.service';
import type { UploadedLocalFile } from './files.service';

const UPLOAD_ROOT = resolve(process.cwd(), 'uploads');
const ALLOWED_FOLDERS = new Set([
  'goods-receipts',
  'documents',
  'products',
  'payments',
  'general',
]);
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

const normalizeUploadFolder = (folder?: string) => {
  const normalized = (folder || 'general').toLowerCase().trim();
  if (!ALLOWED_FOLDERS.has(normalized)) {
    throw new BadRequestException('Upload folder is not allowed');
  }
  return normalized;
};

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {
    if (!fs.existsSync(UPLOAD_ROOT)) {
      console.log(`[FilesService] Creating upload directory: ${UPLOAD_ROOT}`);
      fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    }
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          try {
            const folder = normalizeUploadFolder(req.query.folder as string);
            const now = new Date();
            const year = String(now.getFullYear());
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const uploadPath = resolve(UPLOAD_ROOT, folder, year, month);

            fs.mkdirSync(uploadPath, { recursive: true });
            cb(null, uploadPath);
          } catch (error) {
            cb(error as Error, '');
          }
        },
        filename: (req, file, cb) => {
          const extension = extname(file.originalname).toLowerCase();
          cb(null, `${createOpaqueCode('file')}${extension}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
          return cb(
            new BadRequestException('Only image or PDF files are allowed'),
            false,
          );
        }

        cb(null, true);
      },
      limits: {
        fileSize: 1024 * 1024 * 5,
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: UploadedLocalFile,
    @Query('folder') folder?: string,
    @User() user?: UserEntity,
  ) {
    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }

    const normalizedFolder = normalizeUploadFolder(folder);
    const relativePath = relative(UPLOAD_ROOT, file.path).replace(/\\/g, '/');
    const url = `/uploads/${relativePath}`;
    const asset = await this.filesService.createUploadedFile({
      file,
      folder: normalizedFolder,
      url,
      uploadedByUsername: user?.username || 'system',
    });

    return {
      _id: asset._id,
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      folder: normalizedFolder,
      url,
      uploadedAt: new Date().toISOString(),
    };
  }
}
