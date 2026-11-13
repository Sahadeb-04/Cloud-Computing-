import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  FileWarning,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { StorageSummary, UploadQueueItem } from '../types/memora';
import { formatBytes } from '../lib/utils';
import { Button, Modal } from './ui';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  storage: StorageSummary;
  queue: UploadQueueItem[];
  onFilesSelected: (files: FileList | File[]) => void;
  onCancelItem: (localId: string) => void;
  onRetryItem: (localId: string) => void;
  onClearFinished: () => void;
  onGoToUpgrade: () => void;
}

export function UploadModal({
  open,
  onClose,
  storage,
  queue,
  onFilesSelected,
  onCancelItem,
  onRetryItem,
  onClearFinished,
  onGoToUpgrade,
}: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const isQuotaFull = storage.availableBytes <= 0;
  const activeCount = queue.filter(
    (q) => q.status === 'uploading' || q.status === 'queued'
  ).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload to MEMORA"
      description="Supports JPG, JPEG, PNG, WEBP, GIF, MP4, MOV, and WEBM up to 500 MB per file."
      maxWidth="max-w-2xl"
    >
      {isQuotaFull ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/40 mb-5">
          <div className="flex items-start gap-3">
            <FileWarning className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                Storage limit reached ({formatBytes(storage.usedBytes)} / {formatBytes(storage.quotaBytes)})
              </h4>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                Delete unused files in Trash or upgrade your storage plan to continue uploading.
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  onClose();
                  onGoToUpgrade();
                }}
              >
                Upgrade Storage Plan
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files?.length) {
              onFilesSelected(e.dataTransfer.files);
            }
          }}
          className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
            dragging
              ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30'
              : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-[#0E121B]'
          }`}
        >
          <CloudUpload className="h-10 w-10 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Drag and drop photos or videos here
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
            Available space: {formatBytes(storage.availableBytes)} of {formatBytes(storage.quotaBytes)}
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm,image/*,video/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                onFilesSelected(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Choose files from device
          </Button>
        </div>
      )}

      {queue.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Upload Queue ({queue.length})
            </span>
            {activeCount === 0 && (
              <button
                type="button"
                onClick={onClearFinished}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
              >
                Clear finished
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1">
            {queue.map((item) => (
              <div
                key={item.localId}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0E121B] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {item.file.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {formatBytes(item.file.size)} ·{' '}
                      {item.status === 'uploading' && `${item.progress}%`}
                      {item.status === 'queued' && 'Waiting...'}
                      {item.status === 'completed' && 'Uploaded'}
                      {item.status === 'canceled' && 'Canceled'}
                      {item.status === 'error' && (item.error || 'Failed')}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.status === 'completed' && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                    {(item.status === 'error' || item.status === 'canceled') && (
                      <button
                        type="button"
                        onClick={() => onRetryItem(item.localId)}
                        title="Retry upload"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                    {item.status === 'error' && (
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                    {(item.status === 'uploading' || item.status === 'queued') && (
                      <button
                        type="button"
                        onClick={() => onCancelItem(item.localId)}
                        title="Cancel upload"
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {(item.status === 'uploading' || item.status === 'queued') && (
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-150"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
