import crypto from 'node:crypto';
import { and, desc, eq, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { db } from './index.ts';
import {
  albumMedia,
  albums,
  authTokens,
  DEFAULT_FREE_QUOTA_BYTES,
  favorites,
  mediaFiles,
  notifications,
  PLUS_QUOTA_BYTES,
  PRO_QUOTA_BYTES,
  profiles,
  sharedLinks,
  storageUsage,
  subscriptions,
  uploadFailures,
} from './schema.ts';
import { deleteStoredObject } from '../lib/storage.ts';

const BOOTSTRAP_ADMIN_EMAIL = 'sahadebdas8343@gmail.com';

export async function getProfileByUid(uid: string) {
  try {
    const rows = await db.select().from(profiles).where(eq(profiles.uid, uid)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed (getProfileByUid):', error);
    throw new Error('Failed to load user profile.', { cause: error });
  }
}

export async function getProfileById(id: number) {
  try {
    const rows = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed (getProfileById):', error);
    throw new Error('Failed to load user profile.', { cause: error });
  }
}

export async function getProfileByEmail(email: string) {
  try {
    const rows = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, email.toLowerCase().trim()))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed (getProfileByEmail):', error);
    throw new Error('Failed to look up account.', { cause: error });
  }
}

export async function ensureStorageUsageRow(userId: number) {
  try {
    await db
      .insert(storageUsage)
      .values({
        userId,
        totalBytes: 0,
        photosBytes: 0,
        videosBytes: 0,
        photosCount: 0,
        videosCount: 0,
      })
      .onConflictDoNothing({ target: storageUsage.userId });
  } catch (error) {
    console.error('Failed to ensure storage_usage row:', error);
    throw new Error('Failed to initialize storage tracking.', { cause: error });
  }
}

export async function recalculateStorageUsage(userId: number) {
  try {
    const files = await db
      .select({
        mediaType: mediaFiles.mediaType,
        fileSize: mediaFiles.fileSize,
      })
      .from(mediaFiles)
      .where(eq(mediaFiles.ownerId, userId));

    let totalBytes = 0;
    let photosBytes = 0;
    let videosBytes = 0;
    let photosCount = 0;
    let videosCount = 0;

    for (const f of files) {
      const size = Number(f.fileSize) || 0;
      totalBytes += size;
      if (f.mediaType === 'photo') {
        photosBytes += size;
        photosCount += 1;
      } else {
        videosBytes += size;
        videosCount += 1;
      }
    }

    const updated = await db
      .insert(storageUsage)
      .values({
        userId,
        totalBytes,
        photosBytes,
        videosBytes,
        photosCount,
        videosCount,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: storageUsage.userId,
        set: {
          totalBytes,
          photosBytes,
          videosBytes,
          photosCount,
          videosCount,
          updatedAt: new Date(),
        },
      })
      .returning();

    return updated[0];
  } catch (error) {
    console.error('Failed to recalculate storage usage:', error);
    throw new Error('Failed to update storage accounting.', { cause: error });
  }
}

export async function upsertGoogleUser(params: {
  uid: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  emailVerified: boolean;
}) {
  try {
    const normalizedEmail = params.email.toLowerCase().trim();
    const existingCountRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(profiles);
    const isFirstUser = (existingCountRes[0]?.count ?? 0) === 0;
    const isAdmin = normalizedEmail === BOOTSTRAP_ADMIN_EMAIL || isFirstUser;

    const existingByEmail = await getProfileByEmail(normalizedEmail);
    if (existingByEmail && existingByEmail.uid !== params.uid) {
      const updated = await db
        .update(profiles)
        .set({
          uid: params.uid,
          emailVerified: params.emailVerified || existingByEmail.emailVerified,
          avatarUrl: existingByEmail.avatarUrl || params.avatarUrl || null,
          role: isAdmin ? 'admin' : existingByEmail.role,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, existingByEmail.id))
        .returning();
      await ensureStorageUsageRow(updated[0].id);
      return updated[0];
    }

    const inserted = await db
      .insert(profiles)
      .values({
        uid: params.uid,
        email: normalizedEmail,
        fullName: params.fullName || normalizedEmail.split('@')[0],
        avatarUrl: params.avatarUrl || null,
        emailVerified: params.emailVerified,
        role: isAdmin ? 'admin' : 'user',
        plan: 'free',
        storageQuotaBytes: DEFAULT_FREE_QUOTA_BYTES,
      })
      .onConflictDoUpdate({
        target: profiles.uid,
        set: {
          email: normalizedEmail,
          emailVerified: params.emailVerified,
          updatedAt: new Date(),
        },
      })
      .returning();

    const user = inserted[0];
    await ensureStorageUsageRow(user.id);

    const subs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .limit(1);
    if (!subs.length) {
      await db.insert(subscriptions).values({
        userId: user.id,
        plan: 'free',
        status: 'active',
        quotaBytes: DEFAULT_FREE_QUOTA_BYTES,
      });
    }
    return user;
  } catch (error) {
    console.error('Database upsert failed (upsertGoogleUser):', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function createEmailUser(params: {
  email: string;
  fullName: string;
  passwordHash: string;
}) {
  try {
    const normalizedEmail = params.email.toLowerCase().trim();
    const existingCountRes = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(profiles);
    const isFirstUser = (existingCountRes[0]?.count ?? 0) === 0;
    const isAdmin = normalizedEmail === BOOTSTRAP_ADMIN_EMAIL || isFirstUser;

    const uid = `memora_${crypto.randomUUID()}`;
    const inserted = await db
      .insert(profiles)
      .values({
        uid,
        email: normalizedEmail,
        fullName: params.fullName.trim(),
        passwordHash: params.passwordHash,
        emailVerified: false,
        role: isAdmin ? 'admin' : 'user',
        plan: 'free',
        storageQuotaBytes: DEFAULT_FREE_QUOTA_BYTES,
      })
      .returning();

    const user = inserted[0];
    await ensureStorageUsageRow(user.id);
    await db.insert(subscriptions).values({
      userId: user.id,
      plan: 'free',
      status: 'active',
      quotaBytes: DEFAULT_FREE_QUOTA_BYTES,
    });
    await db.insert(notifications).values({
      userId: user.id,
      title: 'Welcome to MEMORA',
      message: 'Your private cloud vault includes 5 GB of encrypted storage. Verify your email anytime from Settings.',
      type: 'info',
    });
    return user;
  } catch (error) {
    console.error('Database createEmailUser failed:', error);
    throw new Error('Failed to create user account.', { cause: error });
  }
}

export async function createAuthToken(userId: number, type: 'verify_email' | 'reset_password', token: string, hoursValid = 24) {
  try {
    const expiresAt = new Date(Date.now() + hoursValid * 3600 * 1000);
    await db.insert(authTokens).values({
      userId,
      token,
      type,
      expiresAt,
    });
  } catch (error) {
    console.error('Failed to store auth token:', error);
    throw new Error('Failed to create verification token.', { cause: error });
  }
}

export async function consumeAuthToken(token: string, type: 'verify_email' | 'reset_password') {
  try {
    const rows = await db
      .select()
      .from(authTokens)
      .where(and(eq(authTokens.token, token), eq(authTokens.type, type), isNull(authTokens.usedAt)))
      .limit(1);
    const row = rows[0];
    if (!row || row.expiresAt.getTime() < Date.now()) {
      return null;
    }
    await db
      .update(authTokens)
      .set({ usedAt: new Date() })
      .where(eq(authTokens.id, row.id));
    return row;
  } catch (error) {
    console.error('Failed to consume auth token:', error);
    throw new Error('Failed to verify token.', { cause: error });
  }
}

export async function getStorageSummary(userId: number) {
  try {
    await ensureStorageUsageRow(userId);
    const [usageRows, profileRows] = await Promise.all([
      db.select().from(storageUsage).where(eq(storageUsage.userId, userId)).limit(1),
      db.select().from(profiles).where(eq(profiles.id, userId)).limit(1),
    ]);
    const usage = usageRows[0];
    const profile = profileRows[0];
    const quotaBytes = Number(profile?.storageQuotaBytes ?? DEFAULT_FREE_QUOTA_BYTES);
    const totalBytes = Number(usage?.totalBytes ?? 0);
    return {
      quotaBytes,
      usedBytes: totalBytes,
      availableBytes: Math.max(0, quotaBytes - totalBytes),
      photosBytes: Number(usage?.photosBytes ?? 0),
      videosBytes: Number(usage?.videosBytes ?? 0),
      photosCount: Number(usage?.photosCount ?? 0),
      videosCount: Number(usage?.videosCount ?? 0),
      plan: profile?.plan ?? 'free',
    };
  } catch (error) {
    console.error('Failed to get storage summary:', error);
    throw new Error('Failed to load storage summary.', { cause: error });
  }
}

export async function listUserMedia(params: {
  userId: number;
  mediaType?: 'photo' | 'video';
  trashed?: boolean;
  favoritesOnly?: boolean;
  search?: string;
}) {
  try {
    const conditions = [eq(mediaFiles.ownerId, params.userId)];
    if (params.trashed) {
      conditions.push(isNotNull(mediaFiles.deletedAt));
    } else {
      conditions.push(isNull(mediaFiles.deletedAt));
    }
    if (params.mediaType) {
      conditions.push(eq(mediaFiles.mediaType, params.mediaType));
    }
    if (params.search && params.search.trim()) {
      conditions.push(ilike(mediaFiles.filename, `%${params.search.trim()}%`));
    }

    const rows = await db
      .select()
      .from(mediaFiles)
      .where(and(...conditions))
      .orderBy(desc(mediaFiles.uploadDate));

    const favRows = await db
      .select({ mediaId: favorites.mediaId })
      .from(favorites)
      .where(eq(favorites.userId, params.userId));
    const favSet = new Set(favRows.map((r) => r.mediaId));

    const enriched = rows.map((row) => ({
      ...row,
      fileSize: Number(row.fileSize),
      isFavorite: favSet.has(row.id),
    }));

    if (params.favoritesOnly) {
      return enriched.filter((item) => item.isFavorite);
    }
    return enriched;
  } catch (error) {
    console.error('Failed to list user media:', error);
    throw new Error('Failed to load media library.', { cause: error });
  }
}

export async function createMediaRecord(params: {
  id: string;
  ownerId: number;
  filename: string;
  originalFilename: string;
  storagePath: string;
  thumbnailPath: string | null;
  mimeType: string;
  fileSize: number;
  mediaType: 'photo' | 'video';
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
}) {
  try {
    const inserted = await db
      .insert(mediaFiles)
      .values({
        ...params,
        processingStatus: 'ready',
        takenAt: new Date(),
      })
      .returning();
    await recalculateStorageUsage(params.ownerId);
    return inserted[0];
  } catch (error) {
    console.error('Failed to create media record:', error);
    throw new Error('Failed to save uploaded media metadata.', { cause: error });
  }
}

export async function logUploadFailure(params: {
  userId?: number | null;
  filename: string;
  mimeType?: string;
  fileSize?: number;
  reason: string;
}) {
  try {
    await db.insert(uploadFailures).values({
      userId: params.userId ?? null,
      filename: params.filename,
      mimeType: params.mimeType ?? null,
      fileSize: params.fileSize ?? null,
      reason: params.reason,
    });
  } catch (error) {
    console.error('Failed to log upload failure:', error);
  }
}

export async function permanentlyDeleteMediaItem(mediaId: string, ownerId: number) {
  try {
    const rows = await db
      .select()
      .from(mediaFiles)
      .where(and(eq(mediaFiles.id, mediaId), eq(mediaFiles.ownerId, ownerId)))
      .limit(1);
    const item = rows[0];
    if (!item) return false;

    await db.delete(mediaFiles).where(eq(mediaFiles.id, mediaId));
    await deleteStoredObject(item.storagePath);
    await deleteStoredObject(item.thumbnailPath);
    await recalculateStorageUsage(ownerId);
    return true;
  } catch (error) {
    console.error('Failed to delete media permanently:', error);
    throw new Error('Failed to delete media file.', { cause: error });
  }
}

export async function getPlanQuotaBytes(plan: string): Promise<number> {
  if (plan === 'plus') return PLUS_QUOTA_BYTES;
  if (plan === 'pro') return PRO_QUOTA_BYTES;
  return DEFAULT_FREE_QUOTA_BYTES;
}

export async function listUserAlbumsWithStats(userId: number) {
  try {
    const userAlbums = await db
      .select()
      .from(albums)
      .where(eq(albums.ownerId, userId))
      .orderBy(desc(albums.updatedAt));

    const results = [];
    for (const album of userAlbums) {
      const entries = await db
        .select({
          mediaId: albumMedia.mediaId,
          deletedAt: mediaFiles.deletedAt,
          mediaType: mediaFiles.mediaType,
        })
        .from(albumMedia)
        .innerJoin(mediaFiles, eq(albumMedia.mediaId, mediaFiles.id))
        .where(and(eq(albumMedia.albumId, album.id), isNull(mediaFiles.deletedAt)));

      const coverId = album.coverMediaId || entries[0]?.mediaId || null;
      results.push({
        ...album,
        coverMediaId: coverId,
        itemCount: entries.length,
      });
    }
    return results;
  } catch (error) {
    console.error('Failed to list albums:', error);
    throw new Error('Failed to load albums.', { cause: error });
  }
}

export async function listSharedWithUser(email: string) {
  try {
    const normalized = email.toLowerCase().trim();
    const links = await db
      .select()
      .from(sharedLinks)
      .where(
        and(
          eq(sharedLinks.sharedWithEmail, normalized),
          isNull(sharedLinks.revokedAt),
          or(isNull(sharedLinks.expiresAt), sql`${sharedLinks.expiresAt} > now()`)
        )
      )
      .orderBy(desc(sharedLinks.createdAt));

    const enriched = [];
    for (const link of links) {
      const owner = await getProfileById(link.ownerId);
      let mediaItem = null;
      let albumItem = null;
      if (link.targetType === 'media' && link.mediaId) {
        const rows = await db
          .select()
          .from(mediaFiles)
          .where(and(eq(mediaFiles.id, link.mediaId), isNull(mediaFiles.deletedAt)))
          .limit(1);
        mediaItem = rows[0] ? { ...rows[0], fileSize: Number(rows[0].fileSize) } : null;
      } else if (link.targetType === 'album' && link.albumId) {
        const rows = await db
          .select()
          .from(albums)
          .where(eq(albums.id, link.albumId))
          .limit(1);
        albumItem = rows[0] ?? null;
      }
      if (mediaItem || albumItem) {
        enriched.push({
          ...link,
          ownerName: owner?.fullName || 'MEMORA User',
          ownerEmail: owner?.email || '',
          media: mediaItem,
          album: albumItem,
        });
      }
    }
    return enriched;
  } catch (error) {
    console.error('Failed to list shared with me items:', error);
    throw new Error('Failed to load shared media.', { cause: error });
  }
}
