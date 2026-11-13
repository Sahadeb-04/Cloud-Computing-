export type PlanType = 'free' | 'plus' | 'pro';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  role: 'user' | 'admin' | string;
  plan: PlanType;
  storageQuotaBytes: number;
  themePreference: 'light' | 'dark' | string;
  privacyPrivateByDefault: boolean;
  twoFactorEnabled: boolean;
  status: string;
}

export interface StorageSummary {
  quotaBytes: number;
  usedBytes: number;
  availableBytes: number;
  photosBytes: number;
  videosBytes: number;
  photosCount: number;
  videosCount: number;
  plan: PlanType;
}

export interface MediaItem {
  id: string;
  ownerId: number;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  mediaType: 'photo' | 'video';
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  processingStatus: string;
  uploadDate: string;
  takenAt: string | null;
  deletedAt: string | null;
  isFavorite: boolean;
  streamUrl: string;
  thumbnailUrl: string;
  downloadUrl: string | null;
}

export interface AlbumItem {
  id: string;
  ownerId: number;
  title: string;
  description: string | null;
  coverMediaId: string | null;
  coverUrl: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OutgoingShare {
  id: string;
  token: string;
  targetType: 'media' | 'album';
  mediaId: string | null;
  albumId: string | null;
  sharedWithEmail: string | null;
  allowDownload: boolean;
  hasPassword: boolean;
  expiresAt: string | null;
  viewCount: number;
  createdAt: string;
  title: string;
}

export interface SharedWithMeItem {
  id: string;
  token: string;
  targetType: 'media' | 'album';
  allowDownload: boolean;
  hasPassword: boolean;
  expiresAt: string | null;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  media: MediaItem | null;
  album: {
    id: string;
    title: string;
    description: string | null;
  } | null;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  readAt: string | null;
  createdAt: string;
}

export interface UploadQueueItem {
  localId: string;
  file: File;
  progress: number;
  status: 'queued' | 'uploading' | 'completed' | 'error' | 'canceled';
  error?: string;
  abortController?: AbortController;
}

export interface AdminOverview {
  stats: {
    totalUsers: number;
    totalFiles: number;
    totalStorageBytes: number;
    failedUploadsCount: number;
    uptimeSeconds: number;
    memoryMb: number;
  };
  users: Array<{
    id: number;
    uid: string;
    email: string;
    fullName: string;
    role: string;
    plan: string;
    status: string;
    emailVerified: boolean;
    storageQuotaBytes: number;
    usedBytes: number;
    photosCount: number;
    videosCount: number;
    createdAt: string;
  }>;
  failures: Array<{
    id: number;
    userId: number | null;
    filename: string;
    mimeType: string | null;
    fileSize: number | null;
    reason: string;
    createdAt: string;
  }>;
}

export type WorkspaceTab =
  | 'dashboard'
  | 'photos'
  | 'videos'
  | 'albums'
  | 'favorites'
  | 'shared'
  | 'trash'
  | 'storage'
  | 'settings'
  | 'admin';
