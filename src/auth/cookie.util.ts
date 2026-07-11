import { Response } from 'express';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from './session.service';

const isProd = process.env.NODE_ENV === 'production';

export function setSessionCookie(res: Response, sid: string): void {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  });
}

export const PENDING_2FA_COOKIE = 'pending_2fa';

export function setPending2faCookie(res: Response, token: string): void {
  res.cookie(PENDING_2FA_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 5 * 60 * 1000,
    path: '/',
  });
}

export function clearPending2faCookie(res: Response): void {
  res.clearCookie(PENDING_2FA_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  });
}
