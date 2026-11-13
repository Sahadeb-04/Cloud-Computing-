import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, Lock, Play, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { MediaItem } from '../types/memora';
import { formatBytes, formatDateShort, formatDuration } from '../lib/utils';
import { Button, Input } from './ui';

interface PublicShareResponse {
  requiresPassword: boolean;
  targetType: 'media' | 'album';
  ownerName: string;
  allowDownload: boolean;
  expiresAt: string | null;
  media?: MediaItem;
  album?: { id: string; title: string; description: string | null };
  items?: MediaItem[];
}

export function PublicShareView({
  token,
  onExit,
}: {
  token: string;
  onExit: () => void;
}) {
  const [data, setData] = useState<PublicShareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);

  useEffect(() => {
    let active = true;
    apiRequest<PublicShareResponse>(`/api/public/share/${token}`)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Shared resource unavailable.');
      });
    return () => {
      active = false;
    };
  }, [token]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUnlocking(true);
    try {
      const res = await apiRequest<PublicShareResponse>(`/api/public/share/${token}/unlock`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Incorrect password.');
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB] dark:bg-[#0B0D12] text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="font-display text-lg font-bold tracking-tight">MEMORA</span>
            {data && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Shared by {data.ownerName} · {data.allowDownload ? 'Downloads allowed' : 'View-only'}
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onExit}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Open MEMORA
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        {error && !data && (
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-8 text-center">
            <ShieldCheck className="h-8 w-8 text-slate-400 mx-auto mb-3" />
            <h2 className="font-display text-lg font-semibold">Link unavailable</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{error}</p>
            <Button className="mt-6" onClick={onExit}>
              Go to MEMORA
            </Button>
          </div>
        )}

        {data?.requiresPassword && (
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-8">
            <Lock className="h-7 w-7 text-blue-600 mb-3" />
            <h2 className="font-display text-xl font-bold">Password protected share</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {data.ownerName} protected this {data.targetType} with a password.
            </p>
            {error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <form onSubmit={handleUnlock} className="mt-5 space-y-4">
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter share password"
              />
              <Button type="submit" className="w-full" disabled={unlocking}>
                {unlocking ? 'Unlocking...' : 'Unlock shared view'}
              </Button>
            </form>
          </div>
        )}

        {data && !data.requiresPassword && data.media && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h1 className="font-display text-lg font-semibold">{data.media.filename}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {formatDateShort(data.media.uploadDate)} · {formatBytes(data.media.fileSize)}
                </p>
              </div>
              {data.allowDownload && data.media.downloadUrl && (
                <a
                  href={data.media.downloadUrl}
                  download={data.media.filename}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  Download original
                </a>
              )}
            </div>
            <div className="bg-black flex items-center justify-center p-4 min-h-[420px]">
              {data.media.mediaType === 'photo' ? (
                <img
                  src={data.media.streamUrl}
                  alt={data.media.filename}
                  referrerPolicy="no-referrer"
                  className="max-h-[75vh] object-contain"
                />
              ) : (
                <video
                  src={data.media.streamUrl}
                  controls
                  playsInline
                  controlsList={data.allowDownload ? undefined : 'nodownload'}
                  className="max-h-[75vh] w-full max-w-4xl"
                />
              )}
            </div>
          </div>
        )}

        {data && !data.requiresPassword && data.album && (
          <div>
            <div className="mb-8">
              <h1 className="font-display text-2xl font-bold">{data.album.title}</h1>
              {data.album.description && (
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {data.album.description}
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                {data.items?.length || 0} items · {data.allowDownload ? 'Downloads enabled' : 'View-only'}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {(data.items || []).map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] cursor-pointer"
                >
                  <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-900">
                    {item.mediaType === 'photo' ? (
                      <img
                        src={item.thumbnailUrl}
                        alt={item.filename}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
                        <Play className="h-8 w-8" />
                        {item.durationSeconds && (
                          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-mono">
                            {formatDuration(item.durationSeconds)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate">{item.filename}</span>
                    {data.allowDownload && item.downloadUrl && (
                      <a
                        href={item.downloadUrl}
                        download={item.filename}
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 hover:text-blue-700 shrink-0"
                        title="Download original"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedItem && (
              <div
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6"
                onClick={() => setSelectedItem(null)}
              >
                <div
                  className="max-w-4xl w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  {selectedItem.mediaType === 'photo' ? (
                    <img
                      src={selectedItem.streamUrl}
                      alt={selectedItem.filename}
                      referrerPolicy="no-referrer"
                      className="max-h-[85vh] mx-auto object-contain rounded-lg"
                    />
                  ) : (
                    <video
                      src={selectedItem.streamUrl}
                      controls
                      autoPlay
                      controlsList={data.allowDownload ? undefined : 'nodownload'}
                      className="max-h-[85vh] w-full rounded-lg"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
