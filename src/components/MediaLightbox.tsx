import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Heart,
  Share2,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { MediaItem } from '../types/memora';
import { formatBytes, formatDateShort, formatDuration } from '../lib/utils';
import { Button, Input } from './ui';

interface MediaLightboxProps {
  item: MediaItem | null;
  items: MediaItem[];
  onClose: () => void;
  onSelect: (item: MediaItem) => void;
  onToggleFavorite: (item: MediaItem) => void;
  onRename: (item: MediaItem, newName: string) => Promise<void>;
  onMoveToTrash: (item: MediaItem) => void;
  onShare: (item: MediaItem) => void;
}

export function MediaLightbox({
  item,
  items,
  onClose,
  onSelect,
  onToggleFavorite,
  onRename,
  onMoveToTrash,
  onShare,
}: MediaLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  useEffect(() => {
    setZoom(1);
    setEditingName(false);
    setNameDraft(item?.filename || '');
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') {
        const idx = items.findIndex((i) => i.id === item.id);
        if (idx >= 0 && idx < items.length - 1) onSelect(items[idx + 1]);
      }
      if (e.key === 'ArrowLeft') {
        const idx = items.findIndex((i) => i.id === item.id);
        if (idx > 0) onSelect(items[idx - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, items, onClose, onSelect]);

  if (!item) return null;

  const currentIndex = items.findIndex((i) => i.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < items.length - 1;

  const handleSaveRename = async () => {
    if (nameDraft.trim() && nameDraft.trim() !== item.filename) {
      await onRename(item, nameDraft.trim());
    }
    setEditingName(false);
  };

  return (
    <div className="fixed inset-0 z-60 flex flex-col bg-[#06070A]/95 text-white backdrop-blur-sm">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close viewer"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>

          {editingName ? (
            <div className="flex items-center gap-2 max-w-md w-full">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename();
                  if (e.key === 'Escape') setEditingName(false);
                }}
                className="h-8 bg-white/10 border-white/20 text-white text-sm"
                autoFocus
              />
              <Button size="sm" onClick={handleSaveRename}>
                <Check className="h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate">{item.filename}</p>
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  aria-label="Rename file"
                  className="text-white/60 hover:text-white cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-xs text-white/60 font-mono">
                {formatDateShort(item.uploadDate)} · {formatBytes(item.fileSize)}
                {item.width && item.height ? ` · ${item.width} × ${item.height}` : ''}
                {item.durationSeconds ? ` · ${formatDuration(item.durationSeconds)}` : ''}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {item.mediaType === 'photo' && (
            <>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))}
                aria-label="Zoom out"
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono w-10 text-center text-white/80">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, +(z + 0.5).toFixed(1)))}
                aria-label="Zoom in"
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => onToggleFavorite(item)}
            aria-label={item.isFavorite ? 'Remove favorite' : 'Mark favorite'}
            className={`h-9 w-9 inline-flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
              item.isFavorite
                ? 'bg-rose-500/20 text-rose-400'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            <Heart className={`h-4 w-4 ${item.isFavorite ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => onShare(item)}
            aria-label="Share file"
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>

          {item.downloadUrl && (
            <a
              href={item.downloadUrl}
              download={item.filename}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-medium text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          )}

          <button
            type="button"
            onClick={() => onMoveToTrash(item)}
            aria-label="Move to trash"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-white/10 hover:bg-red-600/80 text-white transition-colors cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Viewport */}
      <div className="relative flex-1 flex items-center justify-center overflow-auto p-6">
        {hasPrev && (
          <button
            type="button"
            onClick={() => onSelect(items[currentIndex - 1])}
            aria-label="Previous item"
            className="fixed left-4 top-1/2 -translate-y-1/2 z-10 h-11 w-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center border border-white/15 cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {item.mediaType === 'photo' ? (
          <img
            src={item.streamUrl}
            alt={item.filename}
            referrerPolicy="no-referrer"
            onClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
            style={{ transform: `scale(${zoom})` }}
            className="max-h-full max-w-full object-contain transition-transform duration-150 cursor-zoom-in select-none"
          />
        ) : (
          <video
            key={item.id}
            src={item.streamUrl}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-5xl w-full rounded-xl bg-black shadow-2xl"
          />
        )}

        {hasNext && (
          <button
            type="button"
            onClick={() => onSelect(items[currentIndex + 1])}
            aria-label="Next item"
            className="fixed right-4 top-1/2 -translate-y-1/2 z-10 h-11 w-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center border border-white/15 cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
