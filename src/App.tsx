import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import {
  Bell,
  CloudUpload,
  Film,
  FolderHeart,
  HardDrive,
  Heart,
  Home,
  Image as ImageIcon,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Shield,
  Sun,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { auth } from './lib/firebase';
import { apiRequest, setAuthToken, uploadMediaWithProgress } from './lib/api';
import { isSupportedMediaFile, formatBytes } from './lib/utils';
import {
  AlbumItem,
  MediaItem,
  NotificationItem,
  PlanType,
  SharedWithMeItem,
  StorageSummary,
  UploadQueueItem,
  UserProfile,
  WorkspaceTab,
} from './types/memora';
import { Button, Input, ToastContainer, ToastMessage } from './components/ui';
import { LandingPage } from './components/LandingPage';
import { AuthViews } from './components/AuthViews';
import { UploadModal } from './components/UploadManager';
import { MediaLightbox } from './components/MediaLightbox';
import { ShareModal } from './components/ShareModal';
import { PublicShareView } from './components/PublicShareView';
import {
  AlbumsView,
  DashboardView,
  MediaGalleryView,
  SharedWithMeView,
  TrashView,
  VideosView,
} from './components/WorkspaceMediaViews';
import { AdminView, SettingsView, StorageView } from './components/WorkspaceAccountViews';
import defaultAvatarImg from './assets/images/avatar_user_portrait_1794587582840.jpg';

const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('memora_theme') : null;
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [shareTokenRoute, setShareTokenRoute] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('share');
  });

  const [booting, setBooting] = useState(true);
  const [viewMode, setViewMode] = useState<'landing' | 'auth' | 'workspace'>('landing');
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [storage, setStorage] = useState<StorageSummary>({
    quotaBytes: 5 * 1024 * 1024 * 1024,
    usedBytes: 0,
    availableBytes: 5 * 1024 * 1024 * 1024,
    photosBytes: 0,
    videosBytes: 0,
    photosCount: 0,
    videosCount: 0,
    plan: 'free',
  });
  const [pendingVerifyToken, setPendingVerifyToken] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [trashedMedia, setTrashedMedia] = useState<MediaItem[]>([]);
  const [albums, setAlbums] = useState<AlbumItem[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [sharedWithMe, setSharedWithMe] = useState<SharedWithMeItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [shareTarget, setShareTarget] = useState<{
    type: 'media' | 'album';
    id: string;
    title: string;
  } | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [globalDragActive, setGlobalDragActive] = useState(false);

  const pushToast = useCallback(
    (title: string, type: ToastMessage['type'] = 'info') => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, title, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    window.localStorage.setItem('memora_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(async () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (user) {
      apiRequest('/api/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify({ themePreference: next }),
      }).catch(() => {});
    }
  }, [theme, user]);

  const loadWorkspaceData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [mediaRes, trashRes, albumsRes, sharedRes, storageRes, notifRes] =
        await Promise.all([
          apiRequest<{ items: MediaItem[] }>('/api/media'),
          apiRequest<{ items: MediaItem[] }>('/api/media?trash=true'),
          apiRequest<{ albums: AlbumItem[] }>('/api/albums'),
          apiRequest<{ items: SharedWithMeItem[] }>('/api/shares/with-me'),
          apiRequest<{ storage: StorageSummary }>('/api/storage'),
          apiRequest<{ notifications: NotificationItem[] }>('/api/notifications'),
        ]);
      setMedia(mediaRes.items);
      setTrashedMedia(trashRes.items);
      setAlbums(albumsRes.albums);
      setSharedWithMe(sharedRes.items);
      setStorage(storageRes.storage);
      setNotifications(notifRes.notifications);
    } catch (err: any) {
      pushToast(err.message || 'Failed to sync workspace', 'error');
    } finally {
      setLoadingData(false);
    }
  }, [pushToast]);

  // Initial session restore
  useEffect(() => {
    let active = true;
    apiRequest<{
      user: UserProfile;
      storage: StorageSummary;
      notifications: NotificationItem[];
    }>('/api/auth/me')
      .then((res) => {
        if (!active) return;
        setUser(res.user);
        setStorage(res.storage);
        setNotifications(res.notifications);
        if (res.user.themePreference === 'dark' || res.user.themePreference === 'light') {
          setTheme(res.user.themePreference);
        }
        setViewMode('workspace');
      })
      .catch(() => {
        // Not signed in; stay on landing
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (user && viewMode === 'workspace') {
      loadWorkspaceData();
    }
  }, [user?.id, viewMode, loadWorkspaceData]);

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    await signOut(auth).catch(() => {});
    setAuthToken(null);
    setUser(null);
    setMedia([]);
    setAlbums([]);
    setViewMode('landing');
    pushToast('Signed out safely', 'info');
  };

  // Upload queue processor
  const availableBytesRef = useRef(storage.availableBytes);
  availableBytesRef.current = storage.availableBytes;

  const startSingleUpload = useCallback(
    async (localId: string, file: File) => {
      const controller = new AbortController();
      setUploadQueue((prev) =>
        prev.map((q) =>
          q.localId === localId
            ? { ...q, status: 'uploading', progress: 0, error: undefined, abortController: controller }
            : q
        )
      );

      try {
        const res = await uploadMediaWithProgress(
          file,
          (pct) => {
            setUploadQueue((prev) =>
              prev.map((q) => (q.localId === localId ? { ...q, progress: pct } : q))
            );
          },
          controller.signal
        );

        setUploadQueue((prev) =>
          prev.map((q) => (q.localId === localId ? { ...q, status: 'completed', progress: 100 } : q))
        );
        if (res.storage) setStorage(res.storage);
        if (res.uploaded?.length) {
          setMedia((prev) => [...res.uploaded, ...prev]);
        }
        pushToast(`Uploaded ${file.name}`, 'success');
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          setUploadQueue((prev) =>
            prev.map((q) => (q.localId === localId ? { ...q, status: 'canceled' } : q))
          );
        } else {
          setUploadQueue((prev) =>
            prev.map((q) =>
              q.localId === localId
                ? { ...q, status: 'error', error: err.message || 'Upload failed' }
                : q
            )
          );
          pushToast(err.message || `Failed to upload ${file.name}`, 'error');
        }
      }
    },
    [pushToast]
  );

  const handleFilesSelected = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (!files.length) return;

      let projectedAvailable = availableBytesRef.current;

      for (const file of files) {
        const localId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        if (!isSupportedMediaFile(file)) {
          setUploadQueue((prev) => [
            {
              localId,
              file,
              progress: 0,
              status: 'error',
              error: 'Unsupported format (use JPG, PNG, WEBP, GIF, MP4, MOV, WEBM)',
            },
            ...prev,
          ]);
          continue;
        }

        if (file.size > MAX_UPLOAD_BYTES) {
          setUploadQueue((prev) => [
            {
              localId,
              file,
              progress: 0,
              status: 'error',
              error: `Exceeds 500 MB single-file limit (${formatBytes(file.size)})`,
            },
            ...prev,
          ]);
          continue;
        }

        if (file.size > projectedAvailable) {
          setUploadQueue((prev) => [
            {
              localId,
              file,
              progress: 0,
              status: 'error',
              error: 'Storage quota exceeded. Upgrade plan or empty Trash.',
            },
            ...prev,
          ]);
          pushToast('Storage quota reached. Upgrade or free space.', 'warning');
          continue;
        }

        projectedAvailable -= file.size;
        setUploadQueue((prev) => [
          { localId, file, progress: 0, status: 'queued' },
          ...prev,
        ]);
        startSingleUpload(localId, file);
      }
    },
    [pushToast, startSingleUpload]
  );

  const handleCancelUpload = (localId: string) => {
    const target = uploadQueue.find((q) => q.localId === localId);
    target?.abortController?.abort();
  };

  const handleRetryUpload = (localId: string) => {
    const target = uploadQueue.find((q) => q.localId === localId);
    if (target) startSingleUpload(localId, target.file);
  };

  // Media item handlers
  const handleToggleFavorite = async (item: MediaItem) => {
    try {
      const res = await apiRequest<{ item: MediaItem }>(`/api/media/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isFavorite: !item.isFavorite }),
      });
      setMedia((prev) => prev.map((m) => (m.id === item.id ? res.item : m)));
      if (lightboxItem?.id === item.id) setLightboxItem(res.item);
      pushToast(res.item.isFavorite ? 'Added to favorites' : 'Removed from favorites', 'info');
    } catch (err: any) {
      pushToast(err.message || 'Could not update favorite', 'error');
    }
  };

  const handleRenameMedia = async (item: MediaItem, newName: string) => {
    try {
      const res = await apiRequest<{ item: MediaItem }>(`/api/media/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ filename: newName }),
      });
      setMedia((prev) => prev.map((m) => (m.id === item.id ? res.item : m)));
      if (lightboxItem?.id === item.id) setLightboxItem(res.item);
      pushToast('File renamed', 'success');
    } catch (err: any) {
      pushToast(err.message || 'Rename failed', 'error');
    }
  };

  const handleMoveToTrash = async (item: MediaItem) => {
    try {
      await apiRequest(`/api/media/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ deleted: true }),
      });
      setMedia((prev) => prev.filter((m) => m.id !== item.id));
      const trashRes = await apiRequest<{ items: MediaItem[] }>('/api/media?trash=true');
      setTrashedMedia(trashRes.items);
      if (lightboxItem?.id === item.id) setLightboxItem(null);
      pushToast('Moved to Trash', 'info');
    } catch (err: any) {
      pushToast(err.message || 'Failed to delete item', 'error');
    }
  };

  const handleBulkAction = async (
    ids: string[],
    action: 'trash' | 'favorite' | 'unfavorite' | 'add_to_album',
    albumId?: string
  ) => {
    try {
      await apiRequest('/api/media/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids, action, albumId }),
      });
      await loadWorkspaceData();
      pushToast('Bulk action completed', 'success');
    } catch (err: any) {
      pushToast(err.message || 'Bulk action failed', 'error');
    }
  };

  // Filtered views
  const filteredMedia = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return media;
    return media.filter((m) => m.filename.toLowerCase().includes(q));
  }, [media, searchQuery]);

  const photos = useMemo(
    () => filteredMedia.filter((m) => m.mediaType === 'photo'),
    [filteredMedia]
  );
  const videos = useMemo(
    () => filteredMedia.filter((m) => m.mediaType === 'video'),
    [filteredMedia]
  );
  const favoriteItems = useMemo(
    () => filteredMedia.filter((m) => m.isFavorite),
    [filteredMedia]
  );

  // Public share route
  if (shareTokenRoute) {
    return (
      <PublicShareView
        token={shareTokenRoute}
        onExit={() => {
          window.history.replaceState({}, '', '/');
          setShareTokenRoute(null);
        }}
      />
    );
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-[#FAFAFB] dark:bg-[#0B0D12] flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            MEMORA
          </p>
          <p className="mt-2 text-xs text-slate-500">Loading your private vault...</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'landing') {
    return (
      <LandingPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onGetStarted={() => {
          setAuthInitialMode('register');
          setViewMode('auth');
        }}
        onLogin={() => {
          setAuthInitialMode('login');
          setViewMode('auth');
        }}
      />
    );
  }

  if (viewMode === 'auth' || !user) {
    return (
      <AuthViews
        initialMode={authInitialMode}
        onBackToLanding={() => setViewMode('landing')}
        onAuthenticated={(data) => {
          setUser(data.user);
          setStorage(data.storage);
          if (data.verificationToken) {
            setPendingVerifyToken(data.verificationToken);
          }
          setViewMode('workspace');
          pushToast(`Welcome, ${data.user.fullName}`, 'success');
        }}
      />
    );
  }

  const navItems: Array<{ id: WorkspaceTab; label: string; icon: React.ComponentType<any>; count?: number }> = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'photos', label: 'Photos', icon: ImageIcon, count: photos.length },
    { id: 'videos', label: 'Videos', icon: Film, count: videos.length },
    { id: 'albums', label: 'Albums', icon: FolderHeart, count: albums.length },
    { id: 'favorites', label: 'Favorites', icon: Heart, count: favoriteItems.length },
    { id: 'shared', label: 'Shared With Me', icon: Users, count: sharedWithMe.length },
    { id: 'trash', label: 'Trash', icon: Trash2, count: trashedMedia.length },
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  if (user.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Admin', icon: Shield });
  }

  const usagePct =
    storage.quotaBytes > 0
      ? Math.min(100, Math.round((storage.usedBytes / storage.quotaBytes) * 100))
      : 0;
  const unreadNotifs = notifications.filter((n) => !n.readAt).length;

  return (
    <div
      className="min-h-screen bg-[#FAFAFB] text-slate-900 dark:bg-[#0B0D12] dark:text-slate-100 flex"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setGlobalDragActive(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setGlobalDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setGlobalDragActive(false);
        if (e.dataTransfer.files?.length) {
          setUploadOpen(true);
          handleFilesSelected(e.dataTransfer.files);
        }
      }}
    >
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] sticky top-0 h-screen">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white cursor-pointer"
          >
            MEMORA
          </button>
        </div>

        <div className="p-4">
          <Button className="w-full" onClick={() => setUploadOpen(true)}>
            <CloudUpload className="h-4 w-4" />
            Upload
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== 'albums') setSelectedAlbumId(null);
                }}
                className={`w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 truncate">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Storage Meter */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('storage')}
            className="w-full text-left rounded-xl bg-slate-50 dark:bg-[#0E121B] border border-slate-200 dark:border-slate-800 p-3.5 hover:border-blue-600 transition-colors cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs font-medium mb-2">
              <span className="text-slate-700 dark:text-slate-300">Storage</span>
              <span className="font-mono text-slate-500">{usagePct}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${usagePct > 90 ? 'bg-amber-500' : 'bg-blue-600'}`}
                style={{ width: `${Math.max(usagePct, storage.usedBytes > 0 ? 3 : 0)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {formatBytes(storage.usedBytes)} / {formatBytes(storage.quotaBytes)}
            </p>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-full bg-white dark:bg-[#131722] h-full flex flex-col p-4 z-10 border-r border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-6">
              <span className="font-display text-xl font-bold">MEMORA</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Button
              className="w-full mb-4"
              onClick={() => {
                setMobileMenuOpen(false);
                setUploadOpen(true);
              }}
            >
              <CloudUpload className="h-4 w-4" />
              Upload
            </Button>
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                      active
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
            <Button variant="outline" className="mt-4 w-full" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#0B0D12]/90 backdrop-blur-md px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-xl">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden h-10 w-10 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="relative flex-1">
                <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search photos and videos by filename..."
                  className="pl-10 h-10 bg-slate-50 dark:bg-[#131722]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle color theme"
                className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* Notifications Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={async () => {
                    const next = !notifOpen;
                    setNotifOpen(next);
                    if (next && unreadNotifs > 0) {
                      await apiRequest('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
                      setNotifications((prev) =>
                        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
                      );
                    }
                  }}
                  aria-label="Notifications"
                  className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer relative"
                >
                  <Bell className="h-4 w-4" />
                  {unreadNotifs > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-blue-600 text-[10px] font-mono text-white flex items-center justify-center">
                      {unreadNotifs}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] shadow-xl p-4 z-40">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold">Notifications</span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500">No notifications yet.</p>
                    ) : (
                      <div className="space-y-2.5 max-h-64 overflow-y-auto">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            className="rounded-xl border border-slate-100 dark:border-slate-800 p-3"
                          >
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">
                              {n.title}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {n.message}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer"
              >
                <img
                  src={user.avatarUrl || defaultAvatarImg}
                  alt={user.fullName}
                  referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-full object-cover"
                />
                <span className="hidden sm:inline text-xs font-medium max-w-[120px] truncate">
                  {user.fullName}
                </span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Email verification prompt banner if just registered */}
        {!user.emailVerified && pendingVerifyToken && (
          <div className="bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/60 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-medium text-blue-900 dark:text-blue-200">
              Verify your email ({user.email}) to complete your account security setup.
            </span>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const res = await apiRequest<{ user: UserProfile }>('/api/auth/verify-email', {
                    method: 'POST',
                    body: JSON.stringify({ token: pendingVerifyToken }),
                  });
                  setUser(res.user);
                  setPendingVerifyToken(null);
                  pushToast('Email verified!', 'success');
                } catch (err: any) {
                  pushToast(err.message || 'Verification failed', 'error');
                }
              }}
            >
              Verify Email Now
            </Button>
          </div>
        )}

        {/* Active Workspace View */}
        <main className="flex-1 p-5 sm:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <DashboardView
              user={user}
              storage={storage}
              media={filteredMedia}
              albums={albums}
              loading={loadingData}
              onOpenUpload={() => setUploadOpen(true)}
              onNavigate={setActiveTab}
              onOpenMedia={setLightboxItem}
              onOpenAlbum={(album) => {
                setSelectedAlbumId(album.id);
                setActiveTab('albums');
              }}
            />
          )}

          {activeTab === 'photos' && (
            <MediaGalleryView
              title="Photos"
              subtitle="All uploaded images organized by date"
              items={photos}
              albums={albums}
              loading={loadingData}
              emptyTitle="No photos yet"
              emptyBody="Upload JPG, PNG, WEBP, or GIF images from your device."
              onOpenUpload={() => setUploadOpen(true)}
              onOpenMedia={setLightboxItem}
              onToggleFavorite={handleToggleFavorite}
              onShare={(item) => setShareTarget({ type: 'media', id: item.id, title: item.filename })}
              onMoveToTrash={handleMoveToTrash}
              onBulkAction={handleBulkAction}
            />
          )}

          {activeTab === 'videos' && (
            <VideosView
              videos={videos}
              loading={loadingData}
              onOpenUpload={() => setUploadOpen(true)}
              onOpenMedia={setLightboxItem}
              onShare={(item) => setShareTarget({ type: 'media', id: item.id, title: item.filename })}
              onMoveToTrash={handleMoveToTrash}
              onRename={handleRenameMedia}
            />
          )}

          {activeTab === 'albums' && (
            <AlbumsView
              albums={albums}
              allMedia={media}
              selectedAlbumId={selectedAlbumId}
              onSelectAlbum={setSelectedAlbumId}
              onRefresh={loadWorkspaceData}
              onOpenMedia={setLightboxItem}
              onShareAlbum={(album) => setShareTarget({ type: 'album', id: album.id, title: album.title })}
              onToast={pushToast}
            />
          )}

          {activeTab === 'favorites' && (
            <MediaGalleryView
              title="Favorites"
              subtitle="Starred photos and videos"
              items={favoriteItems}
              albums={albums}
              loading={loadingData}
              emptyTitle="No favorites yet"
              emptyBody="Click the heart icon on any photo or video to pin it here."
              onOpenUpload={() => setUploadOpen(true)}
              onOpenMedia={setLightboxItem}
              onToggleFavorite={handleToggleFavorite}
              onShare={(item) => setShareTarget({ type: 'media', id: item.id, title: item.filename })}
              onMoveToTrash={handleMoveToTrash}
              onBulkAction={handleBulkAction}
            />
          )}

          {activeTab === 'shared' && (
            <SharedWithMeView
              items={sharedWithMe}
              loading={loadingData}
              onOpenShareToken={(token) => setShareTokenRoute(token)}
            />
          )}

          {activeTab === 'trash' && (
            <TrashView
              trashed={trashedMedia}
              loading={loadingData}
              onRestore={async (item) => {
                await apiRequest(`/api/media/${item.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ deleted: false }),
                });
                pushToast(`Restored ${item.filename}`, 'success');
                await loadWorkspaceData();
              }}
              onPermanentDelete={async (item) => {
                await apiRequest(`/api/media/${item.id}`, { method: 'DELETE' });
                pushToast(`Permanently deleted ${item.filename}`, 'info');
                await loadWorkspaceData();
              }}
              onEmptyTrash={async () => {
                await apiRequest('/api/media/trash/empty', { method: 'POST' });
                pushToast('Trash emptied', 'success');
                await loadWorkspaceData();
              }}
            />
          )}

          {activeTab === 'storage' && (
            <StorageView
              storage={storage}
              onUpgradePlan={async (plan: PlanType) => {
                const res = await apiRequest<{ plan: PlanType; storage: StorageSummary }>(
                  '/api/billing/upgrade',
                  {
                    method: 'POST',
                    body: JSON.stringify({ plan }),
                  }
                );
                setStorage(res.storage);
                setUser((prev) => (prev ? { ...prev, plan: res.plan } : prev));
              }}
              onToast={pushToast}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              user={user}
              theme={theme}
              onToggleTheme={toggleTheme}
              onUserUpdated={(updated) => setUser(updated)}
              onAccountDeleted={() => {
                setAuthToken(null);
                setUser(null);
                setViewMode('landing');
                pushToast('Account deleted', 'info');
              }}
              onToast={pushToast}
            />
          )}

          {activeTab === 'admin' && user.role === 'admin' && <AdminView onToast={pushToast} />}
        </main>
      </div>

      {/* Global Drag Overlay */}
      {globalDragActive && (
        <div className="fixed inset-0 z-50 bg-blue-600/15 backdrop-blur-xs border-4 border-dashed border-blue-600 flex items-center justify-center pointer-events-none">
          <div className="rounded-2xl bg-white dark:bg-[#131722] px-8 py-6 shadow-xl text-center">
            <CloudUpload className="h-10 w-10 text-blue-600 mx-auto mb-2" />
            <p className="font-display text-lg font-semibold">Drop files to upload to MEMORA</p>
          </div>
        </div>
      )}

      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        storage={storage}
        queue={uploadQueue}
        onFilesSelected={handleFilesSelected}
        onCancelItem={handleCancelUpload}
        onRetryItem={handleRetryUpload}
        onClearFinished={() =>
          setUploadQueue((prev) =>
            prev.filter((q) => q.status === 'uploading' || q.status === 'queued')
          )
        }
        onGoToUpgrade={() => setActiveTab('storage')}
      />

      <MediaLightbox
        item={lightboxItem}
        items={
          activeTab === 'videos'
            ? videos
            : activeTab === 'favorites'
            ? favoriteItems
            : activeTab === 'photos'
            ? photos
            : filteredMedia
        }
        onClose={() => setLightboxItem(null)}
        onSelect={setLightboxItem}
        onToggleFavorite={handleToggleFavorite}
        onRename={handleRenameMedia}
        onMoveToTrash={handleMoveToTrash}
        onShare={(item) => setShareTarget({ type: 'media', id: item.id, title: item.filename })}
      />

      <ShareModal
        open={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
        target={shareTarget}
        onToast={pushToast}
      />

      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}
