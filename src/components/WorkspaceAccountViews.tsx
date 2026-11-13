import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Camera,
  Check,
  Database,
  HardDrive,
  KeyRound,
  Lock,
  Moon,
  Shield,
  Sun,
  Trash2,
  Users,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { AdminOverview, PlanType, StorageSummary, UserProfile } from '../types/memora';
import { formatBytes, formatDateShort } from '../lib/utils';
import { Button, ConfirmDialog, Input } from './ui';
import defaultAvatarImg from '../assets/images/avatar_user_portrait_1794587582840.jpg';

// ============================================================================
// STORAGE MANAGEMENT VIEW
// ============================================================================
export function StorageView({
  storage,
  onUpgradePlan,
  onToast,
}: {
  storage: StorageSummary;
  onUpgradePlan: (plan: PlanType) => Promise<void>;
  onToast: (title: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [upgrading, setUpgrading] = useState<PlanType | null>(null);
  const usedPct =
    storage.quotaBytes > 0
      ? Math.min(100, (storage.usedBytes / storage.quotaBytes) * 100)
      : 0;
  const photosPct =
    storage.quotaBytes > 0
      ? Math.min(100, (storage.photosBytes / storage.quotaBytes) * 100)
      : 0;
  const videosPct =
    storage.quotaBytes > 0
      ? Math.min(100, (storage.videosBytes / storage.quotaBytes) * 100)
      : 0;

  const plans: Array<{
    id: PlanType;
    name: string;
    quotaLabel: string;
    price: string;
    desc: string;
  }> = [
    {
      id: 'free',
      name: 'FREE',
      quotaLabel: '5 GB',
      price: '$0 / mo',
      desc: 'Personal photo & video archive with albums and share links.',
    },
    {
      id: 'plus',
      name: 'PLUS',
      quotaLabel: '100 GB',
      price: '$4.99 / mo',
      desc: 'Expanded family cloud storage with password-protected album links.',
    },
    {
      id: 'pro',
      name: 'PRO',
      quotaLabel: '1 TB',
      price: '$12.99 / mo',
      desc: 'Creator-grade archive for full-resolution photos and 4K video.',
    },
  ];

  const handleSelectPlan = async (plan: PlanType) => {
    setUpgrading(plan);
    try {
      await onUpgradePlan(plan);
      onToast(`Switched to ${plan.toUpperCase()} storage plan`, 'success');
    } catch (err: any) {
      onToast(err.message || 'Plan update failed', 'error');
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Storage Management
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Real-time accounting calculated from every original file stored in your private vault.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-6 space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Used Storage
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
              {formatBytes(storage.usedBytes)}{' '}
              <span className="text-base font-normal text-slate-500 dark:text-slate-400">
                of {formatBytes(storage.quotaBytes)}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Available Quota
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-emerald-600 dark:text-emerald-400">
              {formatBytes(storage.availableBytes)} free
            </p>
          </div>
        </div>

        {/* Stacked Progress Bar */}
        <div>
          <div className="h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${photosPct}%` }}
              title={`Photos: ${formatBytes(storage.photosBytes)}`}
            />
            <div
              className="h-full bg-violet-600 transition-all"
              style={{ width: `${videosPct}%` }}
              title={`Videos: ${formatBytes(storage.videosBytes)}`}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-6 text-xs text-slate-600 dark:text-slate-300 font-mono">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-xs bg-blue-600" />
              Photos ({storage.photosCount}): {formatBytes(storage.photosBytes)}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-xs bg-violet-600" />
              Videos ({storage.videosCount}): {formatBytes(storage.videosBytes)}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-xs bg-slate-200 dark:bg-slate-700" />
              Total used: {usedPct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Upgrade Storage Plans */}
      <div>
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Storage Plans
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.map((p) => {
            const isCurrent = storage.plan === p.id;
            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-6 flex flex-col justify-between ${
                  isCurrent
                    ? 'border-blue-600 bg-white dark:bg-[#131722]'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-[#131722]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-blue-600 dark:text-blue-400">
                      {p.name}
                    </span>
                    <span className="font-mono text-xs text-slate-500">{p.quotaLabel}</span>
                  </div>
                  <p className="mt-3 font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {p.price}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {p.desc}
                  </p>
                </div>
                <Button
                  className="mt-6 w-full"
                  variant={isCurrent ? 'secondary' : 'primary'}
                  disabled={isCurrent || upgrading !== null}
                  onClick={() => handleSelectPlan(p.id)}
                >
                  {isCurrent ? (
                    <>
                      <Check className="h-4 w-4" />
                      Current Plan
                    </>
                  ) : upgrading === p.id ? (
                    'Updating...'
                  ) : (
                    `Switch to ${p.name}`
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SETTINGS VIEW
// ============================================================================
export function SettingsView({
  user,
  theme,
  onToggleTheme,
  onUserUpdated,
  onAccountDeleted,
  onToast,
}: {
  user: UserProfile;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onUserUpdated: (user: UserProfile) => void;
  onAccountDeleted: () => void;
  onToast: (title: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [privateDefault, setPrivateDefault] = useState(user.privacyPrivateByDefault);
  const [twoFactor, setTwoFactor] = useState(user.twoFactorEnabled);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [verifyTokenInput, setVerifyTokenInput] = useState('');
  const [issuedVerifyToken, setIssuedVerifyToken] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          email,
          privacyPrivateByDefault: privateDefault,
          twoFactorEnabled: twoFactor,
          themePreference: theme,
        }),
      });
      onUserUpdated(res.user);
      onToast('Profile & preferences saved', 'success');
    } catch (err: any) {
      onToast(err.message || 'Failed to save profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/settings/avatar', {
        method: 'POST',
        body: form,
      });
      onUserUpdated(res.user);
      onToast('Profile picture updated', 'success');
    } catch (err: any) {
      onToast(err.message || 'Failed to upload profile picture', 'error');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await apiRequest('/api/settings/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      onToast('Password changed successfully', 'success');
    } catch (err: any) {
      onToast(err.message || 'Could not update password', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRequestVerification = async () => {
    try {
      const res = await apiRequest<{ verificationToken: string }>('/api/auth/resend-verification', {
        method: 'POST',
      });
      setIssuedVerifyToken(res.verificationToken);
      setVerifyTokenInput(res.verificationToken);
      onToast('Verification token generated', 'info');
    } catch (err: any) {
      onToast(err.message || 'Failed to generate verification token', 'error');
    }
  };

  const handleConfirmVerification = async () => {
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: verifyTokenInput }),
      });
      onUserUpdated(res.user);
      setIssuedVerifyToken(null);
      onToast('Email address verified!', 'success');
    } catch (err: any) {
      onToast(err.message || 'Verification failed', 'error');
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your profile, security preferences, theme, and account lifecycle.
        </p>
      </div>

      {/* Profile Picture & Basic Info */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-6 space-y-6"
      >
        <div className="flex items-center gap-5">
          <div className="relative h-16 w-16 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0">
            <img
              src={user.avatarUrl || defaultAvatarImg}
              alt={user.fullName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAvatarUpload(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => avatarInputRef.current?.click()}
            >
              <Camera className="h-3.5 w-3.5" />
              Change profile picture
            </Button>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Account role: {user.role} · Plan: {user.plan.toUpperCase()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Full name
            </label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Email address ({user.emailVerified ? 'Verified' : 'Unverified'})
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        {!user.emailVerified && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-amber-900 dark:text-amber-200">
                Your email address is not verified yet.
              </span>
              <Button type="button" size="sm" variant="outline" onClick={handleRequestVerification}>
                Generate verification token
              </Button>
            </div>
            {issuedVerifyToken && (
              <div className="flex items-center gap-2">
                <Input
                  value={verifyTokenInput}
                  onChange={(e) => setVerifyTokenInput(e.target.value)}
                  className="h-9 text-xs"
                />
                <Button type="button" size="sm" onClick={handleConfirmVerification}>
                  Verify now
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Private by default
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Keep newly uploaded files strictly private until explicitly shared.
              </p>
            </div>
            <input
              type="checkbox"
              checked={privateDefault}
              onChange={(e) => setPrivateDefault(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Extra security sign-in confirmation
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Require explicit verification for sensitive account changes.
              </p>
            </div>
            <input
              type="checkbox"
              checked={twoFactor}
              onChange={(e) => setTwoFactor(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
          </label>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            Theme: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
          </button>

          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </form>

      {/* Change Password */}
      <form
        onSubmit={handlePasswordChange}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Change Password
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password (if set)"
          />
          <Input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (8+ chars)"
          />
        </div>
        <Button type="submit" variant="outline" disabled={savingPassword}>
          {savingPassword ? 'Updating...' : 'Update password'}
        </Button>
      </form>

      {/* Danger Zone: Account Deletion */}
      <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-[#131722] p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-red-600 dark:text-red-400">
            Delete Account
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Permanently remove your profile, albums, share links, and all stored photos and videos.
          </p>
        </div>
        <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)}>
          <Trash2 className="h-4 w-4" />
          Delete account
        </Button>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        destructive
        loading={deleting}
        title="Permanently delete your MEMORA account?"
        message="Every photo, video, album, and shared link owned by your account will be erased permanently. This action cannot be undone."
        confirmLabel="Yes, delete everything"
        onConfirm={async () => {
          setDeleting(true);
          try {
            await apiRequest('/api/settings/account', { method: 'DELETE' });
            onAccountDeleted();
          } catch (err: any) {
            onToast(err.message || 'Account deletion failed', 'error');
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}

// ============================================================================
// PROTECTED ADMIN PANEL
// ============================================================================
export function AdminView({
  onToast,
}: {
  onToast: (title: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [quotaGbInput, setQuotaGbInput] = useState('5');

  const loadAdmin = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<AdminOverview>('/api/admin/overview');
      setData(res);
    } catch (err: any) {
      onToast(err.message || 'Failed to load admin dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmin();
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-bold">Admin Console</h1>
        <div className="h-40 rounded-2xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Administrator Console
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            System health, storage consumption, user quota management, and upload error monitoring.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAdmin}>
          Refresh metrics
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Users</span>
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums">{data.stats.totalUsers}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Stored Files</span>
            <Database className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums">{data.stats.totalFiles}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Consumption</span>
            <HardDrive className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums">
            {formatBytes(data.stats.totalStorageBytes)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Server Health</span>
            <Activity className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            Healthy · {data.stats.memoryMb} MB RSS
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono">
            Uptime {data.stats.uptimeSeconds}s
          </p>
        </div>
      </div>

      {/* User & Quota Management Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            User & Subscription Management
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0E121B]">
              <tr>
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium text-right">Used / Quota</th>
                <th className="px-4 py-3 font-medium text-right">Files</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-6 py-3">
                    <p className="font-medium text-slate-900 dark:text-white">{u.fullName}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={async (e) => {
                        await apiRequest(`/api/admin/users/${u.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ role: e.target.value }),
                        });
                        onToast('User role updated', 'success');
                        await loadAdmin();
                      }}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0E121B] px-2 py-1 text-xs"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.plan}
                      onChange={async (e) => {
                        await apiRequest(`/api/admin/users/${u.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ plan: e.target.value }),
                        });
                        onToast('Subscription plan updated', 'success');
                        await loadAdmin();
                      }}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0E121B] px-2 py-1 text-xs uppercase"
                    >
                      <option value="free">FREE</option>
                      <option value="plus">PLUS</option>
                      <option value="pro">PRO</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {editingUserId === u.id ? (
                      <div className="inline-flex items-center gap-1">
                        <Input
                          type="number"
                          min={1}
                          value={quotaGbInput}
                          onChange={(e) => setQuotaGbInput(e.target.value)}
                          className="h-7 w-16 text-xs"
                        />
                        <span>GB</span>
                        <Button
                          size="sm"
                          onClick={async () => {
                            const bytes = Math.max(1, Number(quotaGbInput)) * 1024 * 1024 * 1024;
                            await apiRequest(`/api/admin/users/${u.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ storageQuotaBytes: bytes }),
                            });
                            setEditingUserId(null);
                            onToast('Quota updated', 'success');
                            await loadAdmin();
                          }}
                        >
                          Save
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingUserId(u.id);
                          setQuotaGbInput(
                            String(Math.round(u.storageQuotaBytes / (1024 * 1024 * 1024)))
                          );
                        }}
                        className="hover:text-blue-600 underline decoration-dotted cursor-pointer"
                      >
                        {formatBytes(u.usedBytes)} / {formatBytes(u.storageQuotaBytes)}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {u.photosCount + u.videosCount}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      type="button"
                      onClick={async () => {
                        const nextStatus = u.status === 'active' ? 'suspended' : 'active';
                        await apiRequest(`/api/admin/users/${u.id}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ status: nextStatus }),
                        });
                        onToast(`User ${nextStatus}`, 'info');
                        await loadAdmin();
                      }}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg border cursor-pointer ${
                        u.status === 'active'
                          ? 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600'
                          : 'border-emerald-300 text-emerald-700 bg-emerald-50'
                      }`}
                    >
                      {u.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failed Upload Monitoring */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Failed Upload Monitoring ({data.failures.length})
          </h2>
        </div>
        {data.failures.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
            No failed uploads recorded.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.failures.map((f) => (
              <div key={f.id} className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{f.filename}</p>
                  <p className="text-xs text-red-600 dark:text-red-400">{f.reason}</p>
                </div>
                <p className="text-xs font-mono text-slate-500">
                  {f.fileSize ? formatBytes(f.fileSize) : '—'} · {formatDateShort(f.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
