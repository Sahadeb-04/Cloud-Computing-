import type { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifySessionToken } from '../lib/security.ts';
import { getProfileById, getProfileByUid, upsertGoogleUser } from '../db/repository.ts';

export interface AuthProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  role: string;
  plan: string;
  storageQuotaBytes: number;
  themePreference: string;
  privacyPrivateByDefault: boolean;
  twoFactorEnabled: boolean;
  status: string;
}

export interface AuthRequest extends Request {
  profile?: AuthProfile;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = decodeURIComponent(part.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

export async function resolveAuthProfile(req: Request): Promise<AuthProfile | null> {
  const authHeader = req.headers.authorization;
  let token: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.memora_session) {
      token = cookies.memora_session;
    }
  }
  if (!token) return null;

  // 1. Check Memora native HMAC session token first
  const session = verifySessionToken(token);
  if (session) {
    const profile = await getProfileById(session.userId);
    if (profile && profile.status === 'active') {
      return {
        ...profile,
        storageQuotaBytes: Number(profile.storageQuotaBytes),
      };
    }
    return null;
  }

  // 2. Otherwise verify Firebase ID token
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    let profile = await getProfileByUid(decoded.uid);
    if (!profile && decoded.email) {
      profile = await upsertGoogleUser({
        uid: decoded.uid,
        email: decoded.email,
        fullName: decoded.name || decoded.email.split('@')[0],
        avatarUrl: decoded.picture || null,
        emailVerified: Boolean(decoded.email_verified),
      });
    }
    if (profile && profile.status === 'active') {
      return {
        ...profile,
        storageQuotaBytes: Number(profile.storageQuotaBytes),
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const profile = await resolveAuthProfile(req);
  if (!profile) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  req.profile = profile;
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.profile) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.profile.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator privileges required.' });
  }
  next();
}
