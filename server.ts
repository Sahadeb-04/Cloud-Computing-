import 'dotenv/config';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { createServer as createViteServer } from 'vite';

import { db } from './src/db/index.ts';
import {
  albumMedia,
  albums,
  favorites,
  mediaFiles,
  notifications,
  profiles,
  sharedLinks,
  storageUsage,
  subscriptions,
  uploadFailures,
} from './src/db/schema.ts';
import {
  consumeAuthToken,
  createAuthToken,
  createEmailUser,
  createMediaRecord,
  getPlanQuotaBytes,
  getProfileByEmail,
  getProfileById,
  getStorageSummary,
  listSharedWithUser,
  listUserAlbumsWithStats,
  listUserMedia,
  logUploadFailure,
  permanentlyDeleteMediaItem,
  recalculateStorageUsage,
  upsertGoogleUser,
} from './src/db/repository.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import {
  checkRateLimit,
  generateOpaqueToken,
  hashPassword,
  signMediaAccessUrl,
  signSessionToken,
  verifyMediaAccessSignature,
  verifyPassword,
} from './src/lib/security.ts';
import {
  detectMediaCategory,
  ensureStorageDirs,
  MAX_SINGLE_FILE_BYTES,
  resolveSafeObjectPath,
  storeAvatarFile,
  storeUploadedMediaFile,
  TEMP_DIR,
} from './src/lib/storage.ts';
import {
  AuthProfile,
  AuthRequest,
  requireAdmin,
  requireAuth,
  resolveAuthProfile,
} from './src/middleware/auth.ts';

await ensureStorageDirs();

const app = express();
app.use(express.json({ limit: '4mb' }));

const upload = multer({
  dest: TEMP_DIR,
  limits: {
    fileSize: MAX_SINGLE_FILE_BYTES,
    files: 20,
  },
});

const avatarUpload = multer({
  dest: TEMP_DIR,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});

function sanitizeProfile(profile: AuthProfile & { passwordHash?: string | null }) {
  const { passwordHash: _ignored, ...safe } = profile as AuthProfile & {
    passwordHash?: string | null;
  };
  return {
    ...safe,
    storageQuotaBytes: Number(safe.storageQuotaBytes),
  };
}

function setSessionCookie(res: express.Response, token: string) {
  res.cookie('memora_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function buildSignedMediaUrls(mediaId: string, hasThumb: boolean, allowDownload = true) {
  const orig = signMediaAccessUrl(mediaId, 'original', 3600, allowDownload);
  const streamUrl = `/api/media/stream/${mediaId}?variant=original&exp=${orig.exp}&dl=${orig.dl}&sig=${orig.sig}`;
  const downloadUrl = allowDownload
    ? `/api/media/stream/${mediaId}?variant=original&download=1&exp=${orig.exp}&dl=${orig.dl}&sig=${orig.sig}`
    : null;
  let thumbnailUrl = streamUrl;
  if (hasThumb) {
    const thumb = signMediaAccessUrl(mediaId, 'thumb', 3600, false);
    thumbnailUrl = `/api/media/stream/${mediaId}?variant=thumb&exp=${thumb.exp}&dl=${thumb.dl}&sig=${thumb.sig}`;
  }
  return { streamUrl, thumbnailUrl, downloadUrl };
}

function attachMediaUrls<T extends { id: string; thumbnailPath: string | null }>(
  item: T,
  allowDownload = true
) {
  const urls = buildSignedMediaUrls(item.id, Boolean(item.thumbnailPath), allowDownload);
  return {
    ...item,
    ...urls,
  };
}

// ============================================================================
// HEALTH & CONFIG STATUS
// ============================================================================
app.get('/api/health', async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({
      status: 'ok',
      database: 'postgresql',
      storage: 'private_object_store',
      supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: 'Database unavailable' });
  }
});

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================
app.post('/api/auth/register', async (req, res) => {
  try {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`auth:${ip}`, 20, 60_000)) {
      return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    }
    const { email, password, fullName } = req.body as {
      email?: string;
      password?: string;
      fullName?: string;
    };

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Full name, email, and password are required.' });
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const existing = await getProfileByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = hashPassword(password);
    const user = await createEmailUser({
      email: normalizedEmail,
      fullName,
      passwordHash,
    });

    const verifyToken = generateOpaqueToken(24);
    await createAuthToken(user.id, 'verify_email', verifyToken, 24);

    const sessionToken = signSessionToken({
      uid: user.uid,
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    setSessionCookie(res, sessionToken);

    const storage = await getStorageSummary(user.id);
    res.status(201).json({
      token: sessionToken,
      user: sanitizeProfile({ ...user, storageQuotaBytes: Number(user.storageQuotaBytes) }),
      storage,
      verificationToken: verifyToken,
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(500).json({ error: error?.message || 'Registration failed.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`auth:${ip}`, 30, 60_000)) {
      return res.status(429).json({ error: 'Too many login attempts. Please wait a minute.' });
    }
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await getProfileByEmail(email);
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account has been suspended by an administrator.' });
    }

    const sessionToken = signSessionToken({
      uid: user.uid,
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    setSessionCookie(res, sessionToken);

    const storage = await getStorageSummary(user.id);
    res.json({
      token: sessionToken,
      user: sanitizeProfile({ ...user, storageQuotaBytes: Number(user.storageQuotaBytes) }),
      storage,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: error?.message || 'Login failed.' });
  }
});

app.post('/api/auth/firebase', async (req, res) => {
  try {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      return res.status(400).json({ error: 'Firebase ID token is required.' });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.email) {
      return res.status(400).json({ error: 'Google account must provide an email address.' });
    }

    const user = await upsertGoogleUser({
      uid: decoded.uid,
      email: decoded.email,
      fullName: decoded.name || decoded.email.split('@')[0],
      avatarUrl: decoded.picture || null,
      emailVerified: Boolean(decoded.email_verified),
    });

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account has been suspended by an administrator.' });
    }

    const sessionToken = signSessionToken({
      uid: user.uid,
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    setSessionCookie(res, sessionToken);

    const storage = await getStorageSummary(user.id);
    res.json({
      token: sessionToken,
      user: sanitizeProfile({ ...user, storageQuotaBytes: Number(user.storageQuotaBytes) }),
      storage,
    });
  } catch (error: any) {
    console.error('Firebase auth sync error:', error);
    res.status(401).json({ error: 'Unable to verify Google credentials.' });
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body as { token?: string };
    if (!token) return res.status(400).json({ error: 'Verification token is required.' });
    const record = await consumeAuthToken(token, 'verify_email');
    if (!record) {
      return res.status(400).json({ error: 'Verification link is invalid or has expired.' });
    }
    const updated = await db
      .update(profiles)
      .set({ emailVerified: true, updatedAt: new Date() })
      .where(eq(profiles.id, record.userId))
      .returning();
    res.json({ verified: true, user: sanitizeProfile({ ...updated[0], storageQuotaBytes: Number(updated[0].storageQuotaBytes) }) });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Verification failed.' });
  }
});

app.post('/api/auth/resend-verification', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const verifyToken = generateOpaqueToken(24);
    await createAuthToken(user.id, 'verify_email', verifyToken, 24);
    res.json({ sent: true, verificationToken: verifyToken });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to generate verification token.' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    const user = await getProfileByEmail(email);
    if (!user) {
      // Do not leak user existence in production semantics, return neutral message
      return res.json({ ok: true, message: 'If an account exists, a reset token has been generated.' });
    }
    const resetToken = generateOpaqueToken(24);
    await createAuthToken(user.id, 'reset_password', resetToken, 2);
    res.json({
      ok: true,
      message: 'Password reset token generated.',
      resetToken,
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to initiate password reset.' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body as { token?: string; newPassword?: string };
    if (!token || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Valid reset token and password (8+ characters) required.' });
    }
    const record = await consumeAuthToken(token, 'reset_password');
    if (!record) {
      return res.status(400).json({ error: 'Reset token is invalid or has expired.' });
    }
    await db
      .update(profiles)
      .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
      .where(eq(profiles.id, record.userId));
    res.json({ reset: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Password reset failed.' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('memora_session', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const [storage, recentNotifications] = await Promise.all([
      getStorageSummary(user.id),
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(15),
    ]);
    res.json({
      user: sanitizeProfile(user),
      storage,
      notifications: recentNotifications,
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load account.' });
  }
});

// ============================================================================
// SETTINGS & PROFILE MANAGEMENT
// ============================================================================
app.patch('/api/settings/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const { fullName, email, themePreference, privacyPrivateByDefault, twoFactorEnabled } = req.body as {
      fullName?: string;
      email?: string;
      themePreference?: 'light' | 'dark';
      privacyPrivateByDefault?: boolean;
      twoFactorEnabled?: boolean;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof fullName === 'string' && fullName.trim().length > 0) {
      updates.fullName = fullName.trim().slice(0, 120);
    }
    if (typeof email === 'string' && email.trim().toLowerCase() !== user.email) {
      const normalized = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return res.status(400).json({ error: 'Invalid email address.' });
      }
      const existing = await getProfileByEmail(normalized);
      if (existing && existing.id !== user.id) {
        return res.status(409).json({ error: 'Email is already in use by another account.' });
      }
      updates.email = normalized;
      updates.emailVerified = false;
    }
    if (themePreference === 'light' || themePreference === 'dark') {
      updates.themePreference = themePreference;
    }
    if (typeof privacyPrivateByDefault === 'boolean') {
      updates.privacyPrivateByDefault = privacyPrivateByDefault;
    }
    if (typeof twoFactorEnabled === 'boolean') {
      updates.twoFactorEnabled = twoFactorEnabled;
    }

    const updated = await db
      .update(profiles)
      .set(updates)
      .where(eq(profiles.id, user.id))
      .returning();

    res.json({
      user: sanitizeProfile({ ...updated[0], storageQuotaBytes: Number(updated[0].storageQuotaBytes) }),
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to update settings.' });
  }
});

app.post('/api/settings/avatar', requireAuth, avatarUpload.single('avatar'), async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }
    const relPath = await storeAvatarFile(req.file.path, user.uid);
    const avatarUrl = `/api/avatar/${path.basename(relPath)}`;
    const updated = await db
      .update(profiles)
      .set({ avatarUrl, updatedAt: new Date() })
      .where(eq(profiles.id, user.id))
      .returning();
    res.json({
      avatarUrl,
      user: sanitizeProfile({ ...updated[0], storageQuotaBytes: Number(updated[0].storageQuotaBytes) }),
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to update profile picture.' });
  }
});

app.get('/api/avatar/:filename', async (req, res) => {
  try {
    const safeName = path.basename(req.params.filename);
    const absPath = resolveSafeObjectPath(path.join('avatars', safeName));
    if (!fs.existsSync(absPath)) {
      return res.status(404).end();
    }
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(absPath).pipe(res);
  } catch {
    res.status(404).end();
  }
});

app.post('/api/settings/password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getProfileById(req.profile!.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    if (user.passwordHash) {
      if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
    }
    await db
      .update(profiles)
      .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
      .where(eq(profiles.id, user.id));
    res.json({ updated: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to update password.' });
  }
});

app.delete('/api/settings/account', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const userFiles = await db
      .select({ id: mediaFiles.id })
      .from(mediaFiles)
      .where(eq(mediaFiles.ownerId, user.id));
    for (const f of userFiles) {
      await permanentlyDeleteMediaItem(f.id, user.id);
    }
    await db.delete(profiles).where(eq(profiles.id, user.id));
    res.clearCookie('memora_session', { path: '/' });
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to delete account.' });
  }
});

// ============================================================================
// CLOUD UPLOAD & MEDIA LIBRARY
// ============================================================================
app.post(
  '/api/media/upload',
  requireAuth,
  (req, res, next) => {
    const user = (req as AuthRequest).profile!;
    if (!checkRateLimit(`upload:${user.id}`, 60, 60_000)) {
      return res.status(429).json({ error: 'Upload rate limit reached. Please wait a moment.' });
    }
    upload.array('files', 20)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Upload failed validation.' });
      }
      next();
    });
  },
  async (req: AuthRequest, res) => {
    const user = req.profile!;
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const uploadedItems = [];
    const errors: { filename: string; reason: string }[] = [];

    try {
      const storage = await getStorageSummary(user.id);
      let runningUsed = storage.usedBytes;
      const quota = storage.quotaBytes;

      for (const file of files) {
        const mediaCategory = detectMediaCategory(file.mimetype, file.originalname);
        if (!mediaCategory) {
          await fsPromises.unlink(file.path).catch(() => {});
          const reason = 'Unsupported file format. Allowed: JPG, JPEG, PNG, WEBP, GIF, MP4, MOV, WEBM.';
          errors.push({ filename: file.originalname, reason });
          await logUploadFailure({
            userId: user.id,
            filename: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            reason,
          });
          continue;
        }

        if (runningUsed + file.size > quota) {
          await fsPromises.unlink(file.path).catch(() => {});
          const reason = 'Storage quota exceeded. Upgrade your plan or free up space.';
          errors.push({ filename: file.originalname, reason });
          await logUploadFailure({
            userId: user.id,
            filename: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            reason,
          });
          continue;
        }

        const stored = await storeUploadedMediaFile({
          tempFilePath: file.path,
          ownerUid: user.uid,
          originalFilename: file.originalname,
          mimeType: file.mimetype,
          mediaType: mediaCategory,
        });

        runningUsed += stored.fileSize;

        const record = await createMediaRecord({
          id: stored.mediaId,
          ownerId: user.id,
          filename: file.originalname,
          originalFilename: file.originalname,
          storagePath: stored.storagePath,
          thumbnailPath: stored.thumbnailPath,
          mimeType: file.mimetype,
          fileSize: stored.fileSize,
          mediaType: mediaCategory,
          width: stored.width,
          height: stored.height,
          durationSeconds: stored.durationSeconds,
        });

        uploadedItems.push(
          attachMediaUrls({
            ...record,
            fileSize: Number(record.fileSize),
            isFavorite: false,
          })
        );
      }

      const updatedStorage = await getStorageSummary(user.id);
      if (uploadedItems.length === 0 && errors.length > 0) {
        return res.status(400).json({
          error: errors[0].reason,
          errors,
          storage: updatedStorage,
        });
      }

      res.status(201).json({
        uploaded: uploadedItems,
        errors,
        storage: updatedStorage,
      });
    } catch (error: any) {
      for (const file of files) {
        await fsPromises.unlink(file.path).catch(() => {});
      }
      console.error('Media upload failed:', error);
      res.status(500).json({ error: error?.message || 'Upload processing failed.' });
    }
  }
);

app.get('/api/media', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const typeParam = req.query.type as string | undefined;
    const mediaType = typeParam === 'photo' || typeParam === 'video' ? typeParam : undefined;
    const trashed = req.query.trash === 'true';
    const favoritesOnly = req.query.favorites === 'true';
    const search = (req.query.search as string) || undefined;

    const items = await listUserMedia({
      userId: user.id,
      mediaType,
      trashed,
      favoritesOnly,
      search,
    });

    res.json({
      items: items.map((item) => attachMediaUrls(item)),
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load media.' });
  }
});

app.patch('/api/media/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const mediaId = req.params.id;
    const rows = await db
      .select()
      .from(mediaFiles)
      .where(and(eq(mediaFiles.id, mediaId), eq(mediaFiles.ownerId, user.id)))
      .limit(1);
    const existing = rows[0];
    if (!existing) {
      return res.status(404).json({ error: 'Media item not found.' });
    }

    const { filename, isFavorite, deleted } = req.body as {
      filename?: string;
      isFavorite?: boolean;
      deleted?: boolean;
    };

    if (typeof filename === 'string' && filename.trim().length > 0) {
      await db
        .update(mediaFiles)
        .set({ filename: filename.trim().slice(0, 180) })
        .where(eq(mediaFiles.id, mediaId));
    }

    if (typeof deleted === 'boolean') {
      await db
        .update(mediaFiles)
        .set({ deletedAt: deleted ? new Date() : null })
        .where(eq(mediaFiles.id, mediaId));
    }

    if (typeof isFavorite === 'boolean') {
      if (isFavorite) {
        await db
          .insert(favorites)
          .values({ userId: user.id, mediaId })
          .onConflictDoNothing();
      } else {
        await db
          .delete(favorites)
          .where(and(eq(favorites.userId, user.id), eq(favorites.mediaId, mediaId)));
      }
    }

    const updatedRows = await db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.id, mediaId))
      .limit(1);
    const favRows = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, user.id), eq(favorites.mediaId, mediaId)))
      .limit(1);

    res.json({
      item: attachMediaUrls({
        ...updatedRows[0],
        fileSize: Number(updatedRows[0].fileSize),
        isFavorite: favRows.length > 0,
      }),
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to update media.' });
  }
});

app.post('/api/media/bulk', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const { ids, action, albumId } = req.body as {
      ids?: string[];
      action?: 'trash' | 'restore' | 'permanent_delete' | 'favorite' | 'unfavorite' | 'add_to_album';
      albumId?: string;
    };
    if (!Array.isArray(ids) || !ids.length || !action) {
      return res.status(400).json({ error: 'Media IDs and action are required.' });
    }

    const owned = await db
      .select({ id: mediaFiles.id })
      .from(mediaFiles)
      .where(and(eq(mediaFiles.ownerId, user.id), inArray(mediaFiles.id, ids)));
    const ownedIds = owned.map((r) => r.id);
    if (!ownedIds.length) {
      return res.status(404).json({ error: 'No matching owned media items found.' });
    }

    if (action === 'trash') {
      await db
        .update(mediaFiles)
        .set({ deletedAt: new Date() })
        .where(inArray(mediaFiles.id, ownedIds));
    } else if (action === 'restore') {
      await db
        .update(mediaFiles)
        .set({ deletedAt: null })
        .where(inArray(mediaFiles.id, ownedIds));
    } else if (action === 'permanent_delete') {
      for (const id of ownedIds) {
        await permanentlyDeleteMediaItem(id, user.id);
      }
    } else if (action === 'favorite') {
      for (const id of ownedIds) {
        await db.insert(favorites).values({ userId: user.id, mediaId: id }).onConflictDoNothing();
      }
    } else if (action === 'unfavorite') {
      await db
        .delete(favorites)
        .where(and(eq(favorites.userId, user.id), inArray(favorites.mediaId, ownedIds)));
    } else if (action === 'add_to_album' && albumId) {
      const albumRows = await db
        .select()
        .from(albums)
        .where(and(eq(albums.id, albumId), eq(albums.ownerId, user.id)))
        .limit(1);
      if (!albumRows.length) {
        return res.status(404).json({ error: 'Target album not found.' });
      }
      for (const id of ownedIds) {
        await db.insert(albumMedia).values({ albumId, mediaId: id }).onConflictDoNothing();
      }
      if (!albumRows[0].coverMediaId) {
        await db
          .update(albums)
          .set({ coverMediaId: ownedIds[0], updatedAt: new Date() })
          .where(eq(albums.id, albumId));
      }
    }

    const storage = await getStorageSummary(user.id);
    res.json({ ok: true, affected: ownedIds.length, storage });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Bulk action failed.' });
  }
});

app.delete('/api/media/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const ok = await permanentlyDeleteMediaItem(req.params.id, user.id);
    if (!ok) return res.status(404).json({ error: 'Media item not found.' });
    const storage = await getStorageSummary(user.id);
    res.json({ deleted: true, storage });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Delete failed.' });
  }
});

app.post('/api/media/trash/empty', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const trashedRows = await db
      .select({ id: mediaFiles.id })
      .from(mediaFiles)
      .where(and(eq(mediaFiles.ownerId, user.id), isNotNull(mediaFiles.deletedAt)));

    for (const row of trashedRows) {
      await permanentlyDeleteMediaItem(row.id, user.id);
    }
    const storage = await getStorageSummary(user.id);
    res.json({ emptied: trashedRows.length, storage });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to empty trash.' });
  }
});

// ============================================================================
// SIGNED PRIVATE STREAMING & HTTP RANGE VIDEO PLAYBACK
// ============================================================================
app.get('/api/media/stream/:id', async (req, res) => {
  try {
    const mediaId = req.params.id;
    const variant = req.query.variant === 'thumb' ? 'thumb' : 'original';
    const download = req.query.download === '1';
    const sig = req.query.sig as string | undefined;
    const exp = Number(req.query.exp);
    const dlFlag = (req.query.dl as string) || '1';

    let authorized = false;
    let downloadAllowed = true;

    if (sig && exp) {
      if (verifyMediaAccessSignature(mediaId, variant, exp, dlFlag, sig)) {
        authorized = true;
        downloadAllowed = dlFlag === '1';
      }
    }

    const rows = await db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.id, mediaId))
      .limit(1);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'File not found.' });

    if (!authorized) {
      const profile = await resolveAuthProfile(req);
      if (profile && profile.id === item.ownerId) {
        authorized = true;
      }
    }

    if (!authorized) {
      return res.status(403).json({ error: 'Access denied or signed URL expired.' });
    }

    if (download && !downloadAllowed) {
      return res.status(403).json({ error: 'Downloading is disabled for this shared view.' });
    }

    const relPath =
      variant === 'thumb' && item.thumbnailPath ? item.thumbnailPath : item.storagePath;
    const absPath = resolveSafeObjectPath(relPath);
    if (!fs.existsSync(absPath)) {
      return res.status(404).json({ error: 'Stored object missing.' });
    }

    const stat = fs.statSync(absPath);
    const total = stat.size;
    const mimeType = variant === 'thumb' && item.thumbnailPath ? 'image/webp' : item.mimeType;

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=1800');

    if (download) {
      const safeDownloadName = item.filename.replace(/"/g, '');
      res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName}"`);
    }

    const range = req.headers.range;
    if (range && !download) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      if (Number.isNaN(start) || start >= total || end >= total || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
        return;
      }
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', chunkSize);
      fs.createReadStream(absPath, { start, end }).pipe(res);
      return;
    }

    res.setHeader('Content-Length', total);
    fs.createReadStream(absPath).pipe(res);
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Failed to stream media.' });
  }
});

// ============================================================================
// ALBUMS
// ============================================================================
app.get('/api/albums', requireAuth, async (req: AuthRequest, res) => {
  try {
    const albumList = await listUserAlbumsWithStats(req.profile!.id);
    const enriched = albumList.map((a) => {
      let coverUrl: string | null = null;
      if (a.coverMediaId) {
        const thumb = signMediaAccessUrl(a.coverMediaId, 'thumb', 3600, false);
        coverUrl = `/api/media/stream/${a.coverMediaId}?variant=thumb&exp=${thumb.exp}&dl=${thumb.dl}&sig=${thumb.sig}`;
      }
      return { ...a, coverUrl };
    });
    res.json({ albums: enriched });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load albums.' });
  }
});

app.get('/api/albums/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const rows = await db
      .select()
      .from(albums)
      .where(and(eq(albums.id, req.params.id), eq(albums.ownerId, user.id)))
      .limit(1);
    const album = rows[0];
    if (!album) return res.status(404).json({ error: 'Album not found.' });

    const mediaRows = await db
      .select({ media: mediaFiles })
      .from(albumMedia)
      .innerJoin(mediaFiles, eq(albumMedia.mediaId, mediaFiles.id))
      .where(and(eq(albumMedia.albumId, album.id), isNull(mediaFiles.deletedAt)))
      .orderBy(desc(albumMedia.addedAt));

    const favRows = await db
      .select({ mediaId: favorites.mediaId })
      .from(favorites)
      .where(eq(favorites.userId, user.id));
    const favSet = new Set(favRows.map((f) => f.mediaId));

    const items = mediaRows.map(({ media }) =>
      attachMediaUrls({
        ...media,
        fileSize: Number(media.fileSize),
        isFavorite: favSet.has(media.id),
      })
    );

    res.json({ album, items });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load album.' });
  }
});

app.post('/api/albums', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const { title, description, mediaIds } = req.body as {
      title?: string;
      description?: string;
      mediaIds?: string[];
    };
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Album title is required.' });
    }
    const id = crypto.randomUUID();
    const coverMediaId = Array.isArray(mediaIds) && mediaIds.length > 0 ? mediaIds[0] : null;
    const inserted = await db
      .insert(albums)
      .values({
        id,
        ownerId: user.id,
        title: title.trim().slice(0, 120),
        description: description?.trim().slice(0, 400) || null,
        coverMediaId,
      })
      .returning();

    if (Array.isArray(mediaIds) && mediaIds.length > 0) {
      const owned = await db
        .select({ id: mediaFiles.id })
        .from(mediaFiles)
        .where(and(eq(mediaFiles.ownerId, user.id), inArray(mediaFiles.id, mediaIds)));
      for (const m of owned) {
        await db.insert(albumMedia).values({ albumId: id, mediaId: m.id }).onConflictDoNothing();
      }
    }

    res.status(201).json({ album: inserted[0] });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to create album.' });
  }
});

app.patch('/api/albums/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const { title, description, coverMediaId } = req.body as {
      title?: string;
      description?: string;
      coverMediaId?: string | null;
    };
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof title === 'string' && title.trim()) updates.title = title.trim().slice(0, 120);
    if (typeof description === 'string') updates.description = description.trim().slice(0, 400);
    if (coverMediaId !== undefined) updates.coverMediaId = coverMediaId;

    const updated = await db
      .update(albums)
      .set(updates)
      .where(and(eq(albums.id, req.params.id), eq(albums.ownerId, user.id)))
      .returning();
    if (!updated.length) return res.status(404).json({ error: 'Album not found.' });
    res.json({ album: updated[0] });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to update album.' });
  }
});

app.delete('/api/albums/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const deleted = await db
      .delete(albums)
      .where(and(eq(albums.id, req.params.id), eq(albums.ownerId, user.id)))
      .returning();
    if (!deleted.length) return res.status(404).json({ error: 'Album not found.' });
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to delete album.' });
  }
});

app.post('/api/albums/:id/media', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const { mediaIds } = req.body as { mediaIds?: string[] };
    if (!Array.isArray(mediaIds) || !mediaIds.length) {
      return res.status(400).json({ error: 'mediaIds array required.' });
    }
    const albumRows = await db
      .select()
      .from(albums)
      .where(and(eq(albums.id, req.params.id), eq(albums.ownerId, user.id)))
      .limit(1);
    if (!albumRows.length) return res.status(404).json({ error: 'Album not found.' });

    const owned = await db
      .select({ id: mediaFiles.id })
      .from(mediaFiles)
      .where(and(eq(mediaFiles.ownerId, user.id), inArray(mediaFiles.id, mediaIds)));
    for (const m of owned) {
      await db
        .insert(albumMedia)
        .values({ albumId: req.params.id, mediaId: m.id })
        .onConflictDoNothing();
    }
    if (!albumRows[0].coverMediaId && owned[0]) {
      await db
        .update(albums)
        .set({ coverMediaId: owned[0].id, updatedAt: new Date() })
        .where(eq(albums.id, req.params.id));
    }
    res.json({ added: owned.length });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to add media to album.' });
  }
});

app.delete('/api/albums/:id/media/:mediaId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const albumRows = await db
      .select()
      .from(albums)
      .where(and(eq(albums.id, req.params.id), eq(albums.ownerId, user.id)))
      .limit(1);
    if (!albumRows.length) return res.status(404).json({ error: 'Album not found.' });
    await db
      .delete(albumMedia)
      .where(
        and(eq(albumMedia.albumId, req.params.id), eq(albumMedia.mediaId, req.params.mediaId))
      );
    res.json({ removed: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to remove media from album.' });
  }
});

// ============================================================================
// SHARING (UNIQUE LINKS, VIEW/DOWNLOAD PERMISSIONS, PASSWORD, EXPIRATION, REVOKE)
// ============================================================================
app.get('/api/shares/outgoing', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const links = await db
      .select()
      .from(sharedLinks)
      .where(and(eq(sharedLinks.ownerId, user.id), isNull(sharedLinks.revokedAt)))
      .orderBy(desc(sharedLinks.createdAt));

    const enriched = await Promise.all(
      links.map(async (link) => {
        let title = 'Shared Item';
        if (link.mediaId) {
          const m = await db
            .select({ filename: mediaFiles.filename })
            .from(mediaFiles)
            .where(eq(mediaFiles.id, link.mediaId))
            .limit(1);
          if (m[0]) title = m[0].filename;
        } else if (link.albumId) {
          const a = await db
            .select({ title: albums.title })
            .from(albums)
            .where(eq(albums.id, link.albumId))
            .limit(1);
          if (a[0]) title = a[0].title;
        }
        return {
          id: link.id,
          token: link.token,
          targetType: link.targetType,
          mediaId: link.mediaId,
          albumId: link.albumId,
          sharedWithEmail: link.sharedWithEmail,
          allowDownload: link.allowDownload,
          hasPassword: Boolean(link.passwordHash),
          expiresAt: link.expiresAt,
          viewCount: link.viewCount,
          createdAt: link.createdAt,
          title,
        };
      })
    );
    res.json({ links: enriched });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load shared links.' });
  }
});

app.get('/api/shares/with-me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await listSharedWithUser(req.profile!.email);
    const enriched = items.map((entry) => ({
      id: entry.id,
      token: entry.token,
      targetType: entry.targetType,
      allowDownload: entry.allowDownload,
      hasPassword: Boolean(entry.passwordHash),
      expiresAt: entry.expiresAt,
      createdAt: entry.createdAt,
      ownerName: entry.ownerName,
      ownerEmail: entry.ownerEmail,
      media: entry.media && !entry.passwordHash
        ? attachMediaUrls(entry.media, entry.allowDownload)
        : entry.media
        ? { id: entry.media.id, filename: entry.media.filename, mediaType: entry.media.mediaType }
        : null,
      album: entry.album,
    }));
    res.json({ items: enriched });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load shared with me.' });
  }
});

app.post('/api/shares', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const {
      targetType,
      mediaId,
      albumId,
      sharedWithEmail,
      allowDownload,
      password,
      expiresInHours,
    } = req.body as {
      targetType?: 'media' | 'album';
      mediaId?: string;
      albumId?: string;
      sharedWithEmail?: string;
      allowDownload?: boolean;
      password?: string;
      expiresInHours?: number | null;
    };

    if (targetType === 'media' && mediaId) {
      const m = await db
        .select()
        .from(mediaFiles)
        .where(and(eq(mediaFiles.id, mediaId), eq(mediaFiles.ownerId, user.id)))
        .limit(1);
      if (!m.length) return res.status(404).json({ error: 'Media item not found.' });
    } else if (targetType === 'album' && albumId) {
      const a = await db
        .select()
        .from(albums)
        .where(and(eq(albums.id, albumId), eq(albums.ownerId, user.id)))
        .limit(1);
      if (!a.length) return res.status(404).json({ error: 'Album not found.' });
    } else {
      return res.status(400).json({ error: 'Invalid share target.' });
    }

    const id = crypto.randomUUID();
    const token = generateOpaqueToken(16);
    const expiresAt =
      typeof expiresInHours === 'number' && expiresInHours > 0
        ? new Date(Date.now() + expiresInHours * 3600 * 1000)
        : null;

    const inserted = await db
      .insert(sharedLinks)
      .values({
        id,
        token,
        ownerId: user.id,
        targetType,
        mediaId: targetType === 'media' ? mediaId! : null,
        albumId: targetType === 'album' ? albumId! : null,
        sharedWithEmail: sharedWithEmail?.trim().toLowerCase() || null,
        allowDownload: Boolean(allowDownload),
        passwordHash: password && password.trim() ? hashPassword(password.trim()) : null,
        expiresAt,
      })
      .returning();

    res.status(201).json({
      share: {
        ...inserted[0],
        hasPassword: Boolean(inserted[0].passwordHash),
        passwordHash: undefined,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to create share link.' });
  }
});

app.delete('/api/shares/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const updated = await db
      .update(sharedLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(sharedLinks.id, req.params.id), eq(sharedLinks.ownerId, user.id)))
      .returning();
    if (!updated.length) return res.status(404).json({ error: 'Share link not found.' });
    res.json({ revoked: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to revoke share link.' });
  }
});

async function resolvePublicShareContent(token: string, passwordAttempt?: string) {
  const rows = await db
    .select()
    .from(sharedLinks)
    .where(eq(sharedLinks.token, token))
    .limit(1);
  const link = rows[0];
  if (!link || link.revokedAt) {
    return { error: 'This shared link has been revoked or does not exist.', status: 404 as const };
  }
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    return { error: 'This shared link has expired.', status: 410 as const };
  }

  const owner = await getProfileById(link.ownerId);
  if (link.passwordHash) {
    if (!passwordAttempt || !verifyPassword(passwordAttempt, link.passwordHash)) {
      return {
        requiresPassword: true,
        targetType: link.targetType,
        ownerName: owner?.fullName || 'MEMORA User',
        expiresAt: link.expiresAt,
        allowDownload: link.allowDownload,
      };
    }
  }

  await db
    .update(sharedLinks)
    .set({ viewCount: link.viewCount + 1 })
    .where(eq(sharedLinks.id, link.id));

  if (link.targetType === 'media' && link.mediaId) {
    const mRows = await db
      .select()
      .from(mediaFiles)
      .where(and(eq(mediaFiles.id, link.mediaId), isNull(mediaFiles.deletedAt)))
      .limit(1);
    if (!mRows.length) return { error: 'Shared file is no longer available.', status: 404 as const };
    return {
      requiresPassword: false,
      targetType: 'media' as const,
      ownerName: owner?.fullName || 'MEMORA User',
      allowDownload: link.allowDownload,
      expiresAt: link.expiresAt,
      media: attachMediaUrls({ ...mRows[0], fileSize: Number(mRows[0].fileSize) }, link.allowDownload),
    };
  }

  if (link.targetType === 'album' && link.albumId) {
    const aRows = await db.select().from(albums).where(eq(albums.id, link.albumId)).limit(1);
    if (!aRows.length) return { error: 'Shared album not found.', status: 404 as const };
    const mediaRows = await db
      .select({ media: mediaFiles })
      .from(albumMedia)
      .innerJoin(mediaFiles, eq(albumMedia.mediaId, mediaFiles.id))
      .where(and(eq(albumMedia.albumId, link.albumId), isNull(mediaFiles.deletedAt)));
    return {
      requiresPassword: false,
      targetType: 'album' as const,
      ownerName: owner?.fullName || 'MEMORA User',
      allowDownload: link.allowDownload,
      expiresAt: link.expiresAt,
      album: aRows[0],
      items: mediaRows.map(({ media }) =>
        attachMediaUrls({ ...media, fileSize: Number(media.fileSize) }, link.allowDownload)
      ),
    };
  }

  return { error: 'Invalid share target.', status: 404 as const };
}

app.get('/api/public/share/:token', async (req, res) => {
  try {
    const result = await resolvePublicShareContent(req.params.token);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to load shared resource.' });
  }
});

app.post('/api/public/share/:token/unlock', async (req, res) => {
  try {
    const { password } = req.body as { password?: string };
    const result = await resolvePublicShareContent(req.params.token, password);
    if ('error' in result && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    if ('requiresPassword' in result && result.requiresPassword) {
      return res.status(401).json({ error: 'Incorrect share password.' });
    }
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to unlock shared resource.' });
  }
});

// ============================================================================
// STORAGE MANAGEMENT, PLANS & NOTIFICATIONS
// ============================================================================
app.get('/api/storage', requireAuth, async (req: AuthRequest, res) => {
  try {
    const storage = await getStorageSummary(req.profile!.id);
    res.json({ storage });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load storage summary.' });
  }
});

app.post('/api/billing/upgrade', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = req.profile!;
    const { plan } = req.body as { plan?: 'free' | 'plus' | 'pro' };
    if (plan !== 'free' && plan !== 'plus' && plan !== 'pro') {
      return res.status(400).json({ error: 'Invalid plan selected.' });
    }
    const quotaBytes = await getPlanQuotaBytes(plan);

    await db
      .update(profiles)
      .set({ plan, storageQuotaBytes: quotaBytes, updatedAt: new Date() })
      .where(eq(profiles.id, user.id));

    await db.insert(subscriptions).values({
      userId: user.id,
      plan,
      status: 'active',
      quotaBytes,
      renewsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    });

    await db.insert(notifications).values({
      userId: user.id,
      title: 'Storage Plan Updated',
      message: `Your account is now on the ${plan.toUpperCase()} plan.`,
      type: 'success',
    });

    const storage = await getStorageSummary(user.id);
    res.json({ plan, storage });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to update plan.' });
  }
});

app.get('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.profile!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    res.json({ notifications: rows });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load notifications.' });
  }
});

app.post('/api/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, req.profile!.id), isNull(notifications.readAt)));
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to mark notifications read.' });
  }
});

// ============================================================================
// PROTECTED ADMIN DASHBOARD ENDPOINTS
// ============================================================================
app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const [usersCountRes, filesCountRes, totalStorageRes, failuresRes, allUsers] =
      await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(profiles),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(mediaFiles)
          .where(isNull(mediaFiles.deletedAt)),
        db
          .select({ total: sql<number>`coalesce(sum(${storageUsage.totalBytes}), 0)::bigint` })
          .from(storageUsage),
        db
          .select()
          .from(uploadFailures)
          .orderBy(desc(uploadFailures.createdAt))
          .limit(25),
        db
          .select({
            id: profiles.id,
            uid: profiles.uid,
            email: profiles.email,
            fullName: profiles.fullName,
            role: profiles.role,
            plan: profiles.plan,
            status: profiles.status,
            emailVerified: profiles.emailVerified,
            storageQuotaBytes: profiles.storageQuotaBytes,
            createdAt: profiles.createdAt,
            usedBytes: storageUsage.totalBytes,
            photosCount: storageUsage.photosCount,
            videosCount: storageUsage.videosCount,
          })
          .from(profiles)
          .leftJoin(storageUsage, eq(profiles.id, storageUsage.userId))
          .orderBy(desc(profiles.createdAt)),
      ]);

    const startedAt = process.uptime();
    res.json({
      stats: {
        totalUsers: usersCountRes[0]?.count ?? 0,
        totalFiles: filesCountRes[0]?.count ?? 0,
        totalStorageBytes: Number(totalStorageRes[0]?.total ?? 0),
        failedUploadsCount: failuresRes.length,
        uptimeSeconds: Math.round(startedAt),
        memoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      },
      users: allUsers.map((u) => ({
        ...u,
        storageQuotaBytes: Number(u.storageQuotaBytes),
        usedBytes: Number(u.usedBytes ?? 0),
        photosCount: Number(u.photosCount ?? 0),
        videosCount: Number(u.videosCount ?? 0),
      })),
      failures: failuresRes.map((f) => ({
        ...f,
        fileSize: f.fileSize ? Number(f.fileSize) : null,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to load admin overview.' });
  }
});

app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const targetId = Number(req.params.id);
    const { plan, storageQuotaBytes, role, status } = req.body as {
      plan?: string;
      storageQuotaBytes?: number;
      role?: 'user' | 'admin';
      status?: 'active' | 'suspended';
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (plan === 'free' || plan === 'plus' || plan === 'pro') {
      updates.plan = plan;
      if (typeof storageQuotaBytes !== 'number') {
        updates.storageQuotaBytes = await getPlanQuotaBytes(plan);
      }
    }
    if (typeof storageQuotaBytes === 'number' && storageQuotaBytes > 0) {
      updates.storageQuotaBytes = storageQuotaBytes;
    }
    if (role === 'user' || role === 'admin') {
      updates.role = role;
    }
    if (status === 'active' || status === 'suspended') {
      updates.status = status;
    }

    const updated = await db
      .update(profiles)
      .set(updates)
      .where(eq(profiles.id, targetId))
      .returning();

    if (!updated.length) return res.status(404).json({ error: 'User not found.' });
    res.json({
      user: sanitizeProfile({ ...updated[0], storageQuotaBytes: Number(updated[0].storageQuotaBytes) }),
    });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to update user.' });
  }
});

// ============================================================================
// VITE / STATIC SERVING
// ============================================================================
const PORT = Number(process.env.PORT) || 3000;

if (process.env.NODE_ENV === 'production') {
  const distDir = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MEMORA server listening on http://0.0.0.0:${PORT}`);
});
