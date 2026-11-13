import React, { useEffect, useState } from 'react';
import { Check, Copy, Link2, Lock, Trash2 } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { OutgoingShare } from '../types/memora';
import { formatDateShort } from '../lib/utils';
import { Button, Input, Modal } from './ui';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  target: {
    type: 'media' | 'album';
    id: string;
    title: string;
  } | null;
  onToast: (title: string, type?: 'success' | 'error' | 'info') => void;
}

export function ShareModal({ open, onClose, target, onToast }: ShareModalProps) {
  const [sharedWithEmail, setSharedWithEmail] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);
  const [password, setPassword] = useState('');
  const [expiresInHours, setExpiresInHours] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [links, setLinks] = useState<OutgoingShare[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadLinks = async () => {
    try {
      const data = await apiRequest<{ links: OutgoingShare[] }>('/api/shares/outgoing');
      if (target) {
        setLinks(
          data.links.filter((l) =>
            target.type === 'media' ? l.mediaId === target.id : l.albumId === target.id
          )
        );
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (open && target) {
      loadLinks();
      setSharedWithEmail('');
      setPassword('');
      setExpiresInHours('');
      setAllowDownload(true);
    }
  }, [open, target?.id]);

  if (!target) return null;

  const getShareUrl = (token: string) => `${window.location.origin}/?share=${token}`;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await apiRequest<{ share: { id: string; token: string } }>('/api/shares', {
        method: 'POST',
        body: JSON.stringify({
          targetType: target.type,
          mediaId: target.type === 'media' ? target.id : undefined,
          albumId: target.type === 'album' ? target.id : undefined,
          sharedWithEmail: sharedWithEmail.trim() || undefined,
          allowDownload,
          password: password.trim() || undefined,
          expiresInHours: expiresInHours ? Number(expiresInHours) : null,
        }),
      });
      await navigator.clipboard?.writeText(getShareUrl(res.share.token)).catch(() => {});
      onToast('Share link created and copied to clipboard', 'success');
      setSharedWithEmail('');
      setPassword('');
      await loadLinks();
    } catch (err: any) {
      onToast(err.message || 'Could not create share link', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await apiRequest(`/api/shares/${id}`, { method: 'DELETE' });
      onToast('Share link revoked', 'info');
      await loadLinks();
    } catch (err: any) {
      onToast(err.message || 'Failed to revoke link', 'error');
    }
  };

  const handleCopy = async (id: string, token: string) => {
    await navigator.clipboard?.writeText(getShareUrl(token)).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Share ${target.type === 'album' ? 'Album' : 'File'}`}
      description={target.title}
    >
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Share with specific MEMORA user email (optional)
          </label>
          <Input
            type="email"
            value={sharedWithEmail}
            onChange={(e) => setSharedWithEmail(e.target.value)}
            placeholder="friend@example.com (appears in their Shared With Me)"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Optional password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank for none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Expiration
            </label>
            <select
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-800 dark:bg-[#0E121B] dark:text-slate-100"
            >
              <option value="">Never expires</option>
              <option value="24">24 hours</option>
              <option value="168">7 days</option>
              <option value="720">30 days</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={allowDownload}
            onChange={(e) => setAllowDownload(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
          />
          <span>Allow recipients to download original files</span>
        </label>

        <Button type="submit" className="w-full" disabled={creating}>
          <Link2 className="h-4 w-4" />
          {creating ? 'Creating link...' : 'Create share link'}
        </Button>
      </form>

      {links.length > 0 && (
        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Active Share Links ({links.length})
          </h4>
          <div className="space-y-2.5 max-h-48 overflow-y-auto">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0E121B] px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-900 dark:text-slate-100">
                    {link.hasPassword && <Lock className="h-3.5 w-3.5 text-blue-600" />}
                    <span className="truncate">
                      {link.sharedWithEmail || 'Anyone with the link'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                    {link.allowDownload ? 'Download enabled' : 'View-only'} · {link.viewCount} views
                    {link.expiresAt ? ` · Expires ${formatDateShort(link.expiresAt)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(link.id, link.token)}
                    className="h-8 px-2.5 inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131722] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {copiedId === link.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(link.id)}
                    title="Revoke link"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
