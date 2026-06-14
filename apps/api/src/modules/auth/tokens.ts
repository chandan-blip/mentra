import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../env.js';

export type AccessTokenClaims = {
  sub: string;
  role: 'student' | 'mentor' | 'admin';
  sessionId: string;
};

export type PasswordResetClaims = {
  sub: string;
  purpose: 'password_reset';
};

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
  });
  if (typeof decoded === 'string') throw new Error('Invalid token payload');
  return {
    sub: String(decoded.sub),
    role: decoded.role as AccessTokenClaims['role'],
    sessionId: String(decoded.sessionId),
  };
}

export function signPasswordResetToken(userId: string): string {
  return jwt.sign({ sub: userId, purpose: 'password_reset' } satisfies PasswordResetClaims, env.JWT_REFRESH_COOKIE_SECRET, {
    algorithm: 'HS256',
    expiresIn: '30m',
  });
}

export function verifyPasswordResetToken(token: string): PasswordResetClaims {
  const decoded = jwt.verify(token, env.JWT_REFRESH_COOKIE_SECRET, {
    algorithms: ['HS256'],
  });
  if (typeof decoded === 'string' || decoded.purpose !== 'password_reset') {
    throw new Error('Invalid password reset token');
  }
  return {
    sub: String(decoded.sub),
    purpose: 'password_reset',
  };
}

export function createRefreshToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
