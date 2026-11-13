import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckSquare,
  CloudUpload,
  Download,
  Edit3,
  Film,
  FolderPlus,
  Grid,
  Heart,
  Image as ImageIcon,
  LayoutGrid,
  Lock,
  Play,
  Plus,
  RotateCcw,
  Share2,
  Square,
  Trash2,
  Users,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import {
  AlbumItem,
  MediaItem,
  SharedWithMeItem,
  StorageSummary,
  UserProfile,
  WorkspaceTab,
} from '../types/memora';
import {
  formatBytes,
  formatDateGroup,
  formatDateShort,
  formatDuration,
} from '../lib/utils';
import { Button, ConfirmDialog, Input, MediaGridSkeleton, Modal } from './ui';

interface MediaCardProps {
  item: MediaItem;
  selected: boolean;
  selectionMode: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (item: MediaItem) => void;
  onToggleFavorite: (item: MediaItem) => void;
  onShare: (item: MediaItem) => void;
  onMoveToTrash: (item: MediaItem) => void;
  masonry?: boolean;
}

function MediaTile({
  item,
  selected,
  selectionMode,
  onToggleSelect,
  onOpen,
  onToggleFavorite,
  onShare,
  onMoveToTrash,
  masonry = false,
}: MediaCardProps) {
  return (
    <div
      className={`group relative rounded-xl overflow-hidden border transition-all duration-150 bg-white dark:bg-[#131722] ${
        selected
          ? 'border-blue-600 ring-2 ring-blue-600/30'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      } ${masonry ? 'break-inside-avoid mb-4' : ''}`}
    >
      <div
        onClick={() => (selectionMode ? onToggleSelect(item.id) : onOpen(item))}
        className={`relative cursor-pointer bg-slate-100 dark:bg-slate-900 overflow-hidden ${
          masonry ? 'w-full' : 'aspect-[4/3]'
        }`}
      >
        {item.mediaType === 'photo' ? (
          <img
            src={item.thumbnailUrl}
            alt={item.filename}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="relative w-full h-full min-h-[160px] bg-slate-900 flex items-center justify-center">
            <video
              src={item.streamUrl}
              preload="metadata"
              muted
              playsInline
              className="w-full h-full object-cover opacity-85"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent flex items-center justify-center">
              <span className="h-11 w-11 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow">
                <Play className="h-5 w-5 ml-0.5" />
              </span>
            </div>
            {item.durationSeconds && (
              <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/75 px-2 py-0.5 text-[11px] font-mono text-white">
                {formatDuration(item.durationSeconds)}
              </span>
            )}
          </div>
        )}

        {/* Selection checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(item.id);
          }}
          aria-label={selected ? 'Deselect item' : 'Select item'}
          className={`absolute top-2.5 left-2.5 h-7 w-7 rounded-lg flex items-center justify-center transition-opacity cursor-pointer ${
            selected
              ? 'bg-blue-600 text-white opacity-100'
              : 'bg-black/50 text-white opacity-0 group-hover:opacity-100'
          }`}
        >
          {selected ? <Check className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>

        {/* Quick favorite button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item);
          }}
          aria-label={item.isFavorite ? 'Remove favorite' : 'Mark favorite'}
          className={`absolute top-2.5 right-2.5 h-7 w-7 rounded-lg flex items-center justify-center transition-opacity cursor-pointer ${
            item.isFavorite
              ? 'bg-rose-600 text-white opacity-100'
              : 'bg-black/50 text-white opacity-0 group-hover:opacity-100'
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${item.isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
            {item.filename}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            {formatBytes(item.fileSize)}
            {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onShare(item)}
            title="Share"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMoveToTrash(item)}
            title="Move to Trash"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD OVERVIEW
// ============================================================================
export function DashboardView({
  user,
  storage,
  media,
  albums,
  loading,
  onOpenUpload,
  onNavigate,
  onOpenMedia,
  onOpenAlbum,
}: {
  user: UserProfile;
  storage: StorageSummary;
  media: MediaItem[];
  albums: AlbumItem[];
  loading: boolean;
  onOpenUpload: () => void;
  onNavigate: (tab: WorkspaceTab) => void;
  onOpenMedia: (item: MediaItem) => void;
  onOpenAlbum: (album: AlbumItem) => void;
}) {
  const usagePct =
    storage.quotaBytes > 0
      ? Math.min(100, Math.round((storage.usedBytes / storage.quotaBytes) * 100))
      : 0;
  const recentUploads = media.slice(0, 8);
  const recentAlbums = albums.slice(0, 4);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome back, {user.fullName.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Every memory. One safe place.
          </p>
        </div>
        <Button onClick={onOpenUpload}>
          <CloudUpload className="h-4 w-4" />
          Upload memories
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-6">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Photos</span>
            <ImageIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {storage.photosCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
            {formatBytes(storage.photosBytes)} stored
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-6">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Total Videos</span>
            <Film className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {storage.videosCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
            {formatBytes(storage.videosBytes)} stored
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-6">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Storage Usage</span>
            <button
              type="button"
              onClick={() => onNavigate('storage')}
              className="text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
            >
              Manage
            </button>
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {formatBytes(storage.usedBytes)}
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all ${
                usagePct > 90 ? 'bg-amber-500' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.max(usagePct, storage.usedBytes > 0 ? 3 : 0)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
            {usagePct}% of {formatBytes(storage.quotaBytes)} ({storage.plan.toUpperCase()})
          </p>
        </div>
      </div>

      {/* Recent Albums */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Recent Albums
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('albums')}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
          >
            View all albums
          </button>
        </div>
        {recentAlbums.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No albums created yet. Group photos and videos into shareable collections.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => onNavigate('albums')}>
              <FolderPlus className="h-4 w-4" />
              Create first album
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {recentAlbums.map((album) => (
              <div
                key={album.id}
                onClick={() => onOpenAlbum(album)}
                className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                  {album.coverUrl ? (
                    <img
                      src={album.coverUrl}
                      alt={album.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {album.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {album.itemCount} items
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Uploads & Gallery Preview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Recent Uploads
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('photos')}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
          >
            Open gallery
          </button>
        </div>

        {loading ? (
          <MediaGridSkeleton count={4} />
        ) : recentUploads.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-12 text-center">
            <CloudUpload className="h-10 w-10 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Your MEMORA vault is ready
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Upload photos and videos from your device to view them in full resolution, organize by date, and share securely.
            </p>
            <Button className="mt-5" onClick={onOpenUpload}>
              <CloudUpload className="h-4 w-4" />
              Upload first file
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {recentUploads.map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenMedia(item)}
                className="group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] cursor-pointer"
              >
                <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-900 overflow-hidden">
                  {item.mediaType === 'photo' ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.filename}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-900 flex items-center justify-center relative">
                      <video
                        src={item.streamUrl}
                        preload="metadata"
                        muted
                        className="w-full h-full object-cover opacity-85"
                      />
                      <span className="absolute h-10 w-10 rounded-full bg-white/95 text-slate-900 flex items-center justify-center">
                        <Play className="h-4 w-4 ml-0.5" />
                      </span>
                    </div>
                  )}
                </div>
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                    {item.filename}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {formatDateShort(item.uploadDate)} · {formatBytes(item.fileSize)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PHOTOS & FAVORITES GALLERY (GRID + MASONRY + DATE GROUPS + BULK ACTIONS)
// ============================================================================
export function MediaGalleryView({
  title,
  subtitle,
  items,
  albums,
  loading,
  emptyTitle,
  emptyBody,
  onOpenUpload,
  onOpenMedia,
  onToggleFavorite,
  onShare,
  onMoveToTrash,
  onBulkAction,
}: {
  title: string;
  subtitle: string;
  items: MediaItem[];
  albums: AlbumItem[];
  loading: boolean;
  emptyTitle: string;
  emptyBody: string;
  onOpenUpload: () => void;
  onOpenMedia: (item: MediaItem) => void;
  onToggleFavorite: (item: MediaItem) => void;
  onShare: (item: MediaItem) => void;
  onMoveToTrash: (item: MediaItem) => void;
  onBulkAction: (
    ids: string[],
    action: 'trash' | 'favorite' | 'unfavorite' | 'add_to_album',
    albumId?: string
  ) => Promise<void>;
}) {
  const [layout, setLayout] = useState<'grid' | 'masonry'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [albumPickerOpen, setAlbumPickerOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const grouped = useMemo(() => {
    const map = new Map<string, MediaItem[]>();
    for (const item of items) {
      const label = formatDateGroup(item.uploadDate);
      const list = map.get(label) || [];
      list.push(item);
      map.set(label, list);
    }
    return Array.from(map.entries());
  }, [items]);

  const handleDownloadSelected = () => {
    const selectedItems = items.filter((i) => selectedSet.has(i.id));
    for (const item of selectedItems) {
      if (item.downloadUrl) {
        const a = document.createElement('a');
        a.href = item.downloadUrl;
        a.download = item.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {subtitle} · {items.length} items
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => setLayout('grid')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 cursor-pointer ${
                layout === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-[#1E2433] dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
              Grid
            </button>
            <button
              type="button"
              onClick={() => setLayout('masonry')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md inline-flex items-center gap-1.5 cursor-pointer ${
                layout === 'masonry'
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-[#1E2433] dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Masonry
            </button>
          </div>
          <Button onClick={onOpenUpload}>
            <CloudUpload className="h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/95 backdrop-blur px-4 py-3 dark:border-blue-900/60 dark:bg-blue-950/80">
          <div className="flex items-center gap-3">
            <CheckSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {selectedIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedIds(items.map((i) => i.id))}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs font-medium text-slate-600 hover:underline dark:text-slate-300 cursor-pointer"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDownloadSelected}>
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAlbumPickerOpen(true)}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Add to album
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await onBulkAction(selectedIds, 'favorite');
                setSelectedIds([]);
              }}
            >
              <Heart className="h-3.5 w-3.5" />
              Favorite
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                await onBulkAction(selectedIds, 'trash');
                setSelectedIds([]);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Move to Trash
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <MediaGridSkeleton count={8} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-12 text-center">
          <ImageIcon className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            {emptyTitle}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{emptyBody}</p>
          <Button className="mt-5" onClick={onOpenUpload}>
            Upload files
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([dateLabel, groupItems]) => (
            <section key={dateLabel}>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                {dateLabel}
              </h2>
              <div
                className={
                  layout === 'masonry'
                    ? 'columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4'
                    : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'
                }
              >
                {groupItems.map((item) => (
                  <MediaTile
                    key={item.id}
                    item={item}
                    masonry={layout === 'masonry'}
                    selected={selectedSet.has(item.id)}
                    selectionMode={selectedIds.length > 0}
                    onToggleSelect={toggleSelect}
                    onOpen={onOpenMedia}
                    onToggleFavorite={onToggleFavorite}
                    onShare={onShare}
                    onMoveToTrash={onMoveToTrash}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={albumPickerOpen}
        onClose={() => setAlbumPickerOpen(false)}
        title="Add selected items to album"
      >
        {albums.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No albums yet. Create an album in the Albums section first.
          </p>
        ) : (
          <div className="space-y-2">
            {albums.map((album) => (
              <button
                key={album.id}
                type="button"
                onClick={async () => {
                  await onBulkAction(selectedIds, 'add_to_album', album.id);
                  setAlbumPickerOpen(false);
                  setSelectedIds([]);
                }}
                className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
              >
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {album.title}
                </span>
                <span className="text-xs text-slate-500 font-mono">{album.itemCount} items</span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ============================================================================
// VIDEOS VIEW
// ============================================================================
export function VideosView({
  videos,
  loading,
  onOpenUpload,
  onOpenMedia,
  onShare,
  onMoveToTrash,
  onRename,
}: {
  videos: MediaItem[];
  loading: boolean;
  onOpenUpload: () => void;
  onOpenMedia: (item: MediaItem) => void;
  onShare: (item: MediaItem) => void;
  onMoveToTrash: (item: MediaItem) => void;
  onRename: (item: MediaItem, newName: string) => Promise<void>;
}) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Videos
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Stream MP4, MOV, and WEBM recordings with full-screen playback · {videos.length} videos
          </p>
        </div>
        <Button onClick={onOpenUpload}>
          <CloudUpload className="h-4 w-4" />
          Upload video
        </Button>
      </div>

      {loading ? (
        <MediaGridSkeleton count={4} />
      ) : videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-12 text-center">
          <Film className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            No videos uploaded yet
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Upload MP4, MOV, or WEBM clips to stream directly from your private archive.
          </p>
          <Button className="mt-5" onClick={onOpenUpload}>
            Upload video
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map((video) => (
            <div
              key={video.id}
              className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722]"
            >
              <div
                onClick={() => onOpenMedia(video)}
                className="relative aspect-video bg-slate-900 cursor-pointer group overflow-hidden"
              >
                <video
                  src={video.streamUrl}
                  preload="metadata"
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent flex items-center justify-center">
                  <span className="h-12 w-12 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-lg transition-transform group-hover:scale-105">
                    <Play className="h-5 w-5 ml-0.5" />
                  </span>
                </div>
                <span className="absolute bottom-2.5 right-2.5 rounded-md bg-black/75 px-2 py-0.5 text-xs font-mono text-white">
                  {video.durationSeconds ? formatDuration(video.durationSeconds) : 'Video'}
                </span>
              </div>

              <div className="p-4">
                {renamingId === video.id ? (
                  <div className="flex items-center gap-2 mb-2">
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="h-8 text-xs"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (renameValue.trim()) {
                          await onRename(video, renameValue.trim());
                        }
                        setRenamingId(null);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {video.filename}
                  </p>
                )}

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {formatBytes(video.fileSize)} · {formatDateShort(video.uploadDate)}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(video.id);
                        setRenameValue(video.filename);
                      }}
                      className="h-8 px-2.5 inline-flex items-center gap-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => onShare(video)}
                      className="h-8 px-2.5 inline-flex items-center gap-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {video.downloadUrl && (
                      <a
                        href={video.downloadUrl}
                        download={video.filename}
                        title="Download original video"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onMoveToTrash(video)}
                      title="Delete video"
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ALBUMS VIEW (LIST + ALBUM DETAIL + COVER PICKER + ADD/REMOVE MEDIA)
// ============================================================================
export function AlbumsView({
  albums,
  allMedia,
  selectedAlbumId,
  onSelectAlbum,
  onRefresh,
  onOpenMedia,
  onShareAlbum,
  onToast,
}: {
  albums: AlbumItem[];
  allMedia: MediaItem[];
  selectedAlbumId: string | null;
  onSelectAlbum: (id: string | null) => void;
  onRefresh: () => Promise<void>;
  onOpenMedia: (item: MediaItem) => void;
  onShareAlbum: (album: { id: string; title: string }) => void;
  onToast: (title: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [detailItems, setDetailItems] = useState<MediaItem[]>([]);
  const [detailAlbum, setDetailAlbum] = useState<AlbumItem | null>(null);
  const [addMediaOpen, setAddMediaOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AlbumItem | null>(null);

  const loadAlbumDetail = async (id: string) => {
    try {
      const data = await apiRequest<{ album: AlbumItem; items: MediaItem[] }>(`/api/albums/${id}`);
      setDetailAlbum(data.album);
      setDetailItems(data.items);
      setRenameDraft(data.album.title);
    } catch (err: any) {
      onToast(err.message || 'Could not load album', 'error');
      onSelectAlbum(null);
    }
  };

  React.useEffect(() => {
    if (selectedAlbumId) {
      loadAlbumDetail(selectedAlbumId);
    } else {
      setDetailAlbum(null);
      setDetailItems([]);
    }
  }, [selectedAlbumId]);

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/albums', {
        method: 'POST',
        body: JSON.stringify({ title: newTitle, description: newDesc }),
      });
      setNewTitle('');
      setNewDesc('');
      setCreateOpen(false);
      onToast('Album created', 'success');
      await onRefresh();
    } catch (err: any) {
      onToast(err.message || 'Failed to create album', 'error');
    }
  };

  if (selectedAlbumId && detailAlbum) {
    const existingIds = new Set(detailItems.map((i) => i.id));
    const availableToAdd = allMedia.filter((m) => !existingIds.has(m.id));

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => onSelectAlbum(null)}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 mb-1 cursor-pointer"
            >
              ← Back to Albums
            </button>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {detailAlbum.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {detailAlbum.description || 'Personal collection'} · {detailItems.length} items
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRenameOpen(true)}>
              <Edit3 className="h-3.5 w-3.5" />
              Rename
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onShareAlbum({ id: detailAlbum.id, title: detailAlbum.title })}
            >
              <Share2 className="h-3.5 w-3.5" />
              Share album
            </Button>
            <Button size="sm" onClick={() => setAddMediaOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add media
            </Button>
          </div>
        </div>

        {detailItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-12 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              This album is empty. Add photos or videos from your library.
            </p>
            <Button className="mt-4" onClick={() => setAddMediaOpen(true)}>
              Add photos or videos
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {detailItems.map((item) => {
              const isCover = detailAlbum.coverMediaId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722]"
                >
                  <div
                    onClick={() => onOpenMedia(item)}
                    className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-900 cursor-pointer"
                  >
                    {item.mediaType === 'photo' ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.filename}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white">
                        <Play className="h-7 w-7" />
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate">{item.filename}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/albums/${detailAlbum.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ coverMediaId: item.id }),
                          });
                          onToast('Album cover updated', 'success');
                          await loadAlbumDetail(detailAlbum.id);
                          await onRefresh();
                        }}
                        className={`text-[11px] font-medium px-2 py-0.5 rounded cursor-pointer ${
                          isCover
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isCover ? 'Cover' : 'Set cover'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/albums/${detailAlbum.id}/media/${item.id}`, {
                            method: 'DELETE',
                          });
                          onToast('Removed from album', 'info');
                          await loadAlbumDetail(detailAlbum.id);
                          await onRefresh();
                        }}
                        title="Remove from album"
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Modal open={addMediaOpen} onClose={() => setAddMediaOpen(false)} title="Add media to album" maxWidth="max-w-2xl">
          {availableToAdd.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              All your active photos and videos are already in this album.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {availableToAdd.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={async () => {
                    await apiRequest(`/api/albums/${detailAlbum.id}/media`, {
                      method: 'POST',
                      body: JSON.stringify({ mediaIds: [item.id] }),
                    });
                    onToast(`Added ${item.filename}`, 'success');
                    await loadAlbumDetail(detailAlbum.id);
                    await onRefresh();
                  }}
                  className="group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 text-left hover:border-blue-600 cursor-pointer"
                >
                  <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-900">
                    {item.mediaType === 'photo' ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.filename}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-900 flex items-center justify-center text-white">
                        <Play className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <p className="px-2.5 py-2 text-xs font-medium truncate text-slate-800 dark:text-slate-200">
                    + {item.filename}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Modal>

        <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename album" maxWidth="max-w-md">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiRequest(`/api/albums/${detailAlbum.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ title: renameDraft }),
              });
              setRenameOpen(false);
              onToast('Album renamed', 'success');
              await loadAlbumDetail(detailAlbum.id);
              await onRefresh();
            }}
            className="space-y-4"
          >
            <Input value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} required />
            <Button type="submit" className="w-full">
              Save name
            </Button>
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Albums
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Organize and share curated collections · {albums.length} albums
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <FolderPlus className="h-4 w-4" />
          New album
        </Button>
      </div>

      {albums.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-12 text-center">
          <FolderPlus className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            No albums yet
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create an album to group trips, events, or client deliverables.
          </p>
          <Button className="mt-5" onClick={() => setCreateOpen(true)}>
            Create album
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {albums.map((album) => (
            <div
              key={album.id}
              className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722]"
            >
              <div
                onClick={() => onSelectAlbum(album.id)}
                className="aspect-[4/3] bg-slate-100 dark:bg-slate-900 cursor-pointer flex items-center justify-center overflow-hidden"
              >
                {album.coverUrl ? (
                  <img
                    src={album.coverUrl}
                    alt={album.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-10 w-10 text-slate-300 dark:text-slate-700" />
                )}
              </div>
              <div className="p-4 flex items-center justify-between gap-3">
                <div
                  onClick={() => onSelectAlbum(album.id)}
                  className="min-w-0 cursor-pointer flex-1"
                >
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {album.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {album.itemCount} items · Updated {formatDateShort(album.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onShareAlbum({ id: album.id, title: album.title })}
                    title="Share album"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(album)}
                    title="Delete album"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create new album" maxWidth="max-w-md">
        <form onSubmit={handleCreateAlbum} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Album title
            </label>
            <Input
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Summer in Kyoto"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Description (optional)
            </label>
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Photos and videos from November trip"
            />
          </div>
          <Button type="submit" className="w-full">
            Create album
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        destructive
        title="Delete album?"
        message={`Deleting "${deleteTarget?.title}" removes the album organization only. Your original photos and videos remain safe in your library.`}
        confirmLabel="Delete album"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await apiRequest(`/api/albums/${deleteTarget.id}`, { method: 'DELETE' });
          setDeleteTarget(null);
          onToast('Album deleted', 'info');
          await onRefresh();
        }}
      />
    </div>
  );
}

// ============================================================================
// SHARED WITH ME VIEW
// ============================================================================
export function SharedWithMeView({
  items,
  loading,
  onOpenShareToken,
}: {
  items: SharedWithMeItem[];
  loading: boolean;
  onOpenShareToken: (token: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Shared With Me
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Photos, videos, and albums shared directly with your MEMORA email address.
        </p>
      </div>

      {loading ? (
        <MediaGridSkeleton count={4} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-12 text-center">
          <Users className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Nothing shared with you yet
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            When someone shares a photo, video, or album with your email, it appears here respecting their view or download permissions.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((entry) => (
            <div
              key={entry.id}
              onClick={() => onOpenShareToken(entry.token)}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] overflow-hidden cursor-pointer hover:border-blue-600 transition-colors"
            >
              <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-900 flex items-center justify-center relative overflow-hidden">
                {entry.hasPassword ? (
                  <div className="text-center p-4">
                    <Lock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Password required
                    </span>
                  </div>
                ) : entry.media && entry.media.mediaType === 'photo' ? (
                  <img
                    src={entry.media.thumbnailUrl}
                    alt={entry.media.filename}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : entry.media ? (
                  <Play className="h-10 w-10 text-slate-500" />
                ) : (
                  <FolderPlus className="h-10 w-10 text-blue-600" />
                )}
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {entry.media?.filename || entry.album?.title || 'Shared Item'}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  From {entry.ownerName} · {entry.allowDownload ? 'Can download' : 'View only'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TRASH VIEW
// ============================================================================
export function TrashView({
  trashed,
  loading,
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
}: {
  trashed: MediaItem[];
  loading: boolean;
  onRestore: (item: MediaItem) => Promise<void>;
  onPermanentDelete: (item: MediaItem) => Promise<void>;
  onEmptyTrash: () => Promise<void>;
}) {
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmItem, setConfirmItem] = useState<MediaItem | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Trash
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Restore deleted files or permanently erase them to free up cloud quota.
          </p>
        </div>
        {trashed.length > 0 && (
          <Button variant="destructive" onClick={() => setConfirmEmpty(true)}>
            <Trash2 className="h-4 w-4" />
            Empty Trash ({trashed.length})
          </Button>
        )}
      </div>

      {loading ? (
        <MediaGridSkeleton count={4} />
      ) : trashed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-12 text-center">
          <Trash2 className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Trash is empty
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Deleted photos and videos appear here before permanent removal.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {trashed.map((item) => (
            <div
              key={item.id}
              className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722]"
            >
              <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-900 flex items-center justify-center overflow-hidden">
                {item.mediaType === 'photo' ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.filename}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-75"
                  />
                ) : (
                  <Film className="h-8 w-8 text-slate-500" />
                )}
              </div>
              <div className="p-3.5">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {item.filename}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {formatBytes(item.fileSize)} · Deleted{' '}
                  {item.deletedAt ? formatDateShort(item.deletedAt) : ''}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onRestore(item)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setConfirmItem(item)}
                    aria-label="Delete permanently"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmEmpty}
        onClose={() => setConfirmEmpty(false)}
        destructive
        title="Empty Trash permanently?"
        message={`This will permanently delete all ${trashed.length} files in Trash and immediately reclaim their storage space. This cannot be undone.`}
        confirmLabel="Empty Trash"
        onConfirm={async () => {
          await onEmptyTrash();
          setConfirmEmpty(false);
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmItem)}
        onClose={() => setConfirmItem(null)}
        destructive
        title="Permanently delete file?"
        message={`"${confirmItem?.filename}" will be permanently removed from object storage.`}
        confirmLabel="Delete forever"
        onConfirm={async () => {
          if (confirmItem) {
            await onPermanentDelete(confirmItem);
            setConfirmItem(null);
          }
        }}
      />
    </div>
  );
}
