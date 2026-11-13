import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

export const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
export const OBJECTS_DIR = path.join(STORAGE_ROOT, 'objects');
export const THUMBS_DIR = path.join(STORAGE_ROOT, 'thumbnails');
export const AVATARS_DIR = path.join(STORAGE_ROOT, 'avatars');
export const TEMP_DIR = path.join(STORAGE_ROOT, 'tmp');

export const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

export const MAX_SINGLE_FILE_BYTES = 500 * 1024 * 1024; // 500 MB per single upload

export async function ensureStorageDirs(): Promise<void> {
  await fs.mkdir(OBJECTS_DIR, { recursive: true });
  await fs.mkdir(THUMBS_DIR, { recursive: true });
  await fs.mkdir(AVATARS_DIR, { recursive: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });
}

export function sanitizeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.slice(0, 140) || 'untitled';
}

export function detectMediaCategory(mimeType: string, filename: string): 'photo' | 'video' | null {
  const lowerMime = mimeType.toLowerCase();
  const ext = path.extname(filename).toLowerCase();
  if (
    ALLOWED_IMAGE_MIMES.has(lowerMime) ||
    ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)
  ) {
    return 'photo';
  }
  if (
    ALLOWED_VIDEO_MIMES.has(lowerMime) ||
    ['.mp4', '.mov', '.webm'].includes(ext)
  ) {
    return 'video';
  }
  return null;
}

export function resolveSafeObjectPath(relPath: string): string {
  const normalized = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.resolve(STORAGE_ROOT, normalized);
  if (!full.startsWith(STORAGE_ROOT)) {
    throw new Error('Invalid storage path traversal attempt');
  }
  return full;
}

/**
 * Parses MP4/MOV 'mvhd' box to extract duration in seconds without external ffmpeg dependency.
 */
export async function extractMp4DurationSeconds(filePath: string): Promise<number | null> {
  try {
    const stat = await fs.stat(filePath);
    const readSize = Math.min(stat.size, 256 * 1024);
    const handle = await fs.open(filePath, 'r');
    try {
      const buf = Buffer.alloc(readSize);
      await handle.read(buf, 0, readSize, 0);
      const idx = buf.indexOf('mvhd');
      if (idx !== -1 && idx + 24 <= buf.length) {
        const version = buf.readUInt8(idx + 4);
        if (version === 0 && idx + 24 <= buf.length) {
          const timescale = buf.readUInt32BE(idx + 16);
          const duration = buf.readUInt32BE(idx + 20);
          if (timescale > 0) return Math.max(1, Math.round(duration / timescale));
        } else if (version === 1 && idx + 36 <= buf.length) {
          const timescale = buf.readUInt32BE(idx + 24);
          const durationBig = buf.readBigUInt64BE(idx + 28);
          if (timescale > 0) return Math.max(1, Math.round(Number(durationBig) / timescale));
        }
      }
      // Also check end of file if moov atom is placed after mdat
      if (stat.size > readSize) {
        const tailStart = Math.max(0, stat.size - 256 * 1024);
        const tailSize = stat.size - tailStart;
        const tailBuf = Buffer.alloc(tailSize);
        await handle.read(tailBuf, 0, tailSize, tailStart);
        const tailIdx = tailBuf.indexOf('mvhd');
        if (tailIdx !== -1 && tailIdx + 24 <= tailBuf.length) {
          const version = tailBuf.readUInt8(tailIdx + 4);
          if (version === 0 && tailIdx + 24 <= tailBuf.length) {
            const timescale = tailBuf.readUInt32BE(tailIdx + 16);
            const duration = tailBuf.readUInt32BE(tailIdx + 20);
            if (timescale > 0) return Math.max(1, Math.round(duration / timescale));
          }
        }
      }
    } finally {
      await handle.close();
    }
  } catch {
    // fallback silently
  }
  return null;
}

export async function storeUploadedMediaFile(params: {
  tempFilePath: string;
  ownerUid: string;
  originalFilename: string;
  mimeType: string;
  mediaType: 'photo' | 'video';
}): Promise<{
  mediaId: string;
  storagePath: string;
  thumbnailPath: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  fileSize: number;
}> {
  await ensureStorageDirs();
  const mediaId = crypto.randomUUID();
  const safeName = sanitizeFilename(params.originalFilename);
  const ext = path.extname(safeName) || (params.mediaType === 'photo' ? '.jpg' : '.mp4');

  const userObjectsDir = path.join(OBJECTS_DIR, params.ownerUid);
  const userThumbsDir = path.join(THUMBS_DIR, params.ownerUid);
  await fs.mkdir(userObjectsDir, { recursive: true });
  await fs.mkdir(userThumbsDir, { recursive: true });

  const objectFilename = `${mediaId}${ext}`;
  const absObjectPath = path.join(userObjectsDir, objectFilename);
  const relStoragePath = path.relative(STORAGE_ROOT, absObjectPath);

  await fs.rename(params.tempFilePath, absObjectPath);
  const stat = await fs.stat(absObjectPath);

  let width: number | null = null;
  let height: number | null = null;
  let durationSeconds: number | null = null;
  let relThumbnailPath: string | null = null;

  if (params.mediaType === 'photo') {
    try {
      const metadata = await sharp(absObjectPath).metadata();
      width = metadata.width ?? null;
      height = metadata.height ?? null;

      const thumbFilename = `${mediaId}_thumb.webp`;
      const absThumbPath = path.join(userThumbsDir, thumbFilename);
      await sharp(absObjectPath)
        .rotate()
        .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(absThumbPath);
      relThumbnailPath = path.relative(STORAGE_ROOT, absThumbPath);
    } catch (err) {
      console.error('Image thumbnail processing warning:', err);
    }
  } else {
    durationSeconds = await extractMp4DurationSeconds(absObjectPath);
  }

  return {
    mediaId,
    storagePath: relStoragePath,
    thumbnailPath: relThumbnailPath,
    width,
    height,
    durationSeconds,
    fileSize: stat.size,
  };
}

export async function storeAvatarFile(tempFilePath: string, ownerUid: string): Promise<string> {
  await ensureStorageDirs();
  const filename = `${ownerUid}_${Date.now()}.webp`;
  const absPath = path.join(AVATARS_DIR, filename);
  await sharp(tempFilePath)
    .rotate()
    .resize(256, 256, { fit: 'cover' })
    .webp({ quality: 86 })
    .toFile(absPath);
  await fs.unlink(tempFilePath).catch(() => {});
  return path.relative(STORAGE_ROOT, absPath);
}

export async function deleteStoredObject(relPath: string | null | undefined): Promise<void> {
  if (!relPath) return;
  try {
    const absPath = resolveSafeObjectPath(relPath);
    if (fsSync.existsSync(absPath)) {
      await fs.unlink(absPath);
    }
  } catch (err) {
    console.error('Failed to delete object from disk:', err);
  }
}
