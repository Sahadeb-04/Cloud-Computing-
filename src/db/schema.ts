import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const DEFAULT_FREE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
export const PLUS_QUOTA_BYTES = 100 * 1024 * 1024 * 1024; // 100 GB
export const PRO_QUOTA_BYTES = 1024 * 1024 * 1024 * 1024; // 1 TB

export const profiles = pgTable(
  'profiles',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull().unique(),
    fullName: text('full_name').notNull(),
    avatarUrl: text('avatar_url'),
    passwordHash: text('password_hash'),
    emailVerified: boolean('email_verified').notNull().default(false),
    role: text('role').notNull().default('user'),
    plan: text('plan').notNull().default('free'),
    storageQuotaBytes: bigint('storage_quota_bytes', { mode: 'number' })
      .notNull()
      .default(DEFAULT_FREE_QUOTA_BYTES),
    themePreference: text('theme_preference').notNull().default('light'),
    privacyPrivateByDefault: boolean('privacy_private_by_default').notNull().default(true),
    twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('profiles_email_idx').on(table.email)]
);

export const authTokens = pgTable('auth_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  token: text('token').notNull().unique(),
  type: text('type').notNull(), // 'verify_email' | 'reset_password'
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const mediaFiles = pgTable(
  'media_files',
  {
    id: text('id').primaryKey(),
    ownerId: integer('owner_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    filename: text('filename').notNull(),
    originalFilename: text('original_filename').notNull(),
    storagePath: text('storage_path').notNull(),
    thumbnailPath: text('thumbnail_path'),
    mimeType: text('mime_type').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    mediaType: text('media_type').notNull(), // 'photo' | 'video'
    width: integer('width'),
    height: integer('height'),
    durationSeconds: integer('duration_seconds'),
    processingStatus: text('processing_status').notNull().default('ready'), // 'pending' | 'processing' | 'ready' | 'failed'
    uploadDate: timestamp('upload_date').defaultNow().notNull(),
    takenAt: timestamp('taken_at'),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('media_files_owner_idx').on(table.ownerId),
    index('media_files_type_idx').on(table.mediaType),
    index('media_files_deleted_idx').on(table.deletedAt),
  ]
);

export const albums = pgTable(
  'albums',
  {
    id: text('id').primaryKey(),
    ownerId: integer('owner_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    description: text('description'),
    coverMediaId: text('cover_media_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('albums_owner_idx').on(table.ownerId)]
);

export const albumMedia = pgTable(
  'album_media',
  {
    id: serial('id').primaryKey(),
    albumId: text('album_id')
      .references(() => albums.id, { onDelete: 'cascade' })
      .notNull(),
    mediaId: text('media_id')
      .references(() => mediaFiles.id, { onDelete: 'cascade' })
      .notNull(),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('album_media_unique_idx').on(table.albumId, table.mediaId)]
);

export const favorites = pgTable(
  'favorites',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    mediaId: text('media_id')
      .references(() => mediaFiles.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('favorites_user_media_idx').on(table.userId, table.mediaId)]
);

export const sharedLinks = pgTable(
  'shared_links',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    ownerId: integer('owner_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    targetType: text('target_type').notNull(), // 'media' | 'album'
    mediaId: text('media_id').references(() => mediaFiles.id, { onDelete: 'cascade' }),
    albumId: text('album_id').references(() => albums.id, { onDelete: 'cascade' }),
    sharedWithEmail: text('shared_with_email'),
    allowDownload: boolean('allow_download').notNull().default(false),
    passwordHash: text('password_hash'),
    expiresAt: timestamp('expires_at'),
    revokedAt: timestamp('revoked_at'),
    viewCount: integer('view_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('shared_links_owner_idx').on(table.ownerId),
    index('shared_links_email_idx').on(table.sharedWithEmail),
  ]
);

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  plan: text('plan').notNull().default('free'),
  status: text('status').notNull().default('active'),
  quotaBytes: bigint('quota_bytes', { mode: 'number' })
    .notNull()
    .default(DEFAULT_FREE_QUOTA_BYTES),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  renewsAt: timestamp('renews_at'),
});

export const storageUsage = pgTable('storage_usage', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  totalBytes: bigint('total_bytes', { mode: 'number' }).notNull().default(0),
  photosBytes: bigint('photos_bytes', { mode: 'number' }).notNull().default(0),
  videosBytes: bigint('videos_bytes', { mode: 'number' }).notNull().default(0),
  photosCount: integer('photos_count').notNull().default(0),
  videosCount: integer('videos_count').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  type: text('type').notNull().default('info'),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const uploadFailures = pgTable('upload_failures', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => profiles.id, { onDelete: 'set null' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type'),
  fileSize: bigint('file_size', { mode: 'number' }),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const profilesRelations = relations(profiles, ({ many, one }) => ({
  mediaFiles: many(mediaFiles),
  albums: many(albums),
  favorites: many(favorites),
  sharedLinks: many(sharedLinks),
  subscriptions: many(subscriptions),
  storageUsage: one(storageUsage),
  notifications: many(notifications),
}));

export const mediaFilesRelations = relations(mediaFiles, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [mediaFiles.ownerId],
    references: [profiles.id],
  }),
  albumEntries: many(albumMedia),
  favorites: many(favorites),
}));

export const albumsRelations = relations(albums, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [albums.ownerId],
    references: [profiles.id],
  }),
  albumEntries: many(albumMedia),
}));
