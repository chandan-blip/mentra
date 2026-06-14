import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db, type DbSession, type DbUser } from '../../db.js';
import { emit } from '../../core/events.js';
import type { ForgotPasswordInput, LoginInput, ResetPasswordInput, SignupInput } from './auth.schema.js';
import {
  addDays,
  createRefreshToken,
  hashRefreshToken,
  signAccessToken,
  signPasswordResetToken,
  verifyPasswordResetToken,
} from './tokens.js';

const refreshCookieName = 'mentra_refresh';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'mentor' | 'admin';
  createdAt: string;
};

export class AuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export async function signup(input: SignupInput, req: Request, res: Response) {
  const existing = await findUserByEmail(input.email);
  if (existing) throw new AuthError('EMAIL_TAKEN', 'An account already exists for this email');

  const passwordHash = await argon2.hash(input.password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const userId = createId();
  const identityId = createId();

  await db.execute<ResultSetHeader>(
    'INSERT INTO `User` (`id`, `email`, `passwordHash`, `name`) VALUES (:id, :email, :passwordHash, :name)',
    { id: userId, email: input.email, passwordHash, name: input.name },
  );
  await db.execute<ResultSetHeader>(
    'INSERT INTO `AuthIdentity` (`id`, `userId`, `provider`, `providerId`) VALUES (:id, :userId, :provider, :providerId)',
    { id: identityId, userId, provider: 'email', providerId: input.email },
  );

  const user = await findUserById(userId);
  if (!user) throw new AuthError('USER_CREATE_FAILED', 'Unable to create account', 500);

  // Email signups are active immediately (no OTP step in MVP), so treat signup
  // as verification — downstream modules create the profile off this event.
  emit('user.verified', { userId: user.id, email: user.email });

  return createSessionResponse(toAuthUser(user), req, res, true);
}

export async function login(input: LoginInput, req: Request, res: Response) {
  const user = await findUserByEmail(input.email);
  if (!user?.passwordHash) throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password', 401);

  const valid = await argon2.verify(user.passwordHash, input.password);
  if (!valid) throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  if (user.status !== 'active') throw new AuthError('USER_INACTIVE', 'Account is not active', 403);

  return createSessionResponse(toAuthUser(user), req, res, input.rememberMe);
}

export async function refresh(req: Request, res: Response) {
  const token = req.cookies?.[refreshCookieName];
  if (!token) throw new AuthError('REFRESH_REQUIRED', 'Refresh token is required', 401);

  const tokenHash = hashRefreshToken(token);
  const session = await findSessionByRefreshHash(tokenHash);
  const user = session ? await findUserById(session.userId) : null;

  if (!session || !user || session.revokedAt || session.expiresAt <= new Date() || user.status !== 'active') {
    clearRefreshCookie(res);
    throw new AuthError('REFRESH_INVALID', 'Refresh token is invalid', 401);
  }

  const nextRefresh = createRefreshToken();
  const nextHash = hashRefreshToken(nextRefresh);
  const rememberMe = Boolean(session.rememberMe);
  const expiresAt = addDays(new Date(), rememberMe ? 30 : 1);

  const connection = await db.getConnection();
  const nextSessionId = createId();
  try {
    await connection.beginTransaction();
    await connection.execute('UPDATE `Session` SET `revokedAt` = NOW(3) WHERE `id` = ?', [
      session.id,
    ]);
    await connection.execute(
      'INSERT INTO `Session` (`id`, `userId`, `refreshTokenHash`, `familyId`, `rememberMe`, `userAgent`, `ip`, `expiresAt`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        nextSessionId,
        session.userId,
        nextHash,
        session.familyId,
        rememberMe,
        req.get('user-agent') ?? null,
        req.ip ?? null,
        expiresAt,
      ],
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  setRefreshCookie(res, nextRefresh, rememberMe ? expiresAt : undefined);
  const authUser = toAuthUser(user);
  return {
    accessToken: signAccessToken({ sub: authUser.id, role: authUser.role, sessionId: nextSessionId }),
    user: authUser,
  };
}

export async function getMe(userId: string): Promise<AuthUser> {
  const user = await findUserById(userId);
  if (!user) throw new AuthError('USER_NOT_FOUND', 'User not found', 404);
  return toAuthUser(user);
}

export async function logout(sessionId: string | undefined, res: Response) {
  if (sessionId) {
    await db.execute<ResultSetHeader>(
      'UPDATE `Session` SET `revokedAt` = NOW(3) WHERE `id` = :id AND `revokedAt` IS NULL',
      { id: sessionId },
    );
  }
  clearRefreshCookie(res);
}

export async function forgotPassword(input: ForgotPasswordInput) {
  const user = await findUserByEmail(input.email);
  if (!user) return { sent: true };

  const resetToken = signPasswordResetToken(user.id);
  return {
    sent: true,
    resetToken: process.env.NODE_ENV === 'production' ? undefined : resetToken,
    expiresInMinutes: 30,
  };
}

export async function resetPassword(input: ResetPasswordInput) {
  let claims: { sub: string };
  try {
    claims = verifyPasswordResetToken(input.token);
  } catch {
    throw new AuthError('RESET_TOKEN_INVALID', 'Password reset link is invalid or expired', 400);
  }

  const user = await findUserById(claims.sub);
  if (!user) throw new AuthError('RESET_TOKEN_INVALID', 'Password reset link is invalid or expired', 400);

  const passwordHash = await argon2.hash(input.newPassword, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  await db.execute<ResultSetHeader>(
    'UPDATE `User` SET `passwordHash` = :passwordHash WHERE `id` = :id',
    { id: user.id, passwordHash },
  );
  await db.execute<ResultSetHeader>(
    'UPDATE `Session` SET `revokedAt` = NOW(3) WHERE `userId` = :userId AND `revokedAt` IS NULL',
    { userId: user.id },
  );

  return { reset: true };
}

async function createSessionResponse(user: AuthUser, req: Request, res: Response, rememberMe: boolean) {
  const refreshToken = createRefreshToken();
  const expiresAt = addDays(new Date(), rememberMe ? 30 : 1);
  const sessionId = createId();
  await db.execute<ResultSetHeader>(
    'INSERT INTO `Session` (`id`, `userId`, `refreshTokenHash`, `familyId`, `rememberMe`, `userAgent`, `ip`, `expiresAt`) VALUES (:id, :userId, :refreshTokenHash, :familyId, :rememberMe, :userAgent, :ip, :expiresAt)',
    {
      id: sessionId,
      userId: user.id,
      refreshTokenHash: hashRefreshToken(refreshToken),
      familyId: randomUUID(),
      rememberMe,
      userAgent: req.get('user-agent') ?? null,
      ip: req.ip ?? null,
      expiresAt,
    },
  );

  setRefreshCookie(res, refreshToken, rememberMe ? expiresAt : undefined);
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role, sessionId }),
    user,
  };
}

function setRefreshCookie(res: Response, token: string, expiresAt?: Date) {
  res.cookie(refreshCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/v1/auth',
    ...(expiresAt ? { expires: expiresAt } : {}),
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(refreshCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/v1/auth',
  });
}

function toAuthUser(user: {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'mentor' | 'admin';
  createdAt: Date;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

async function findUserByEmail(email: string): Promise<DbUser | null> {
  const [rows] = await db.execute<(DbUser & RowDataPacket)[]>(
    'SELECT `id`, `email`, `passwordHash`, `name`, `role`, `status`, `emailVerified`, `createdAt` FROM `User` WHERE `email` = :email LIMIT 1',
    { email },
  );
  return rows[0] ?? null;
}

async function findUserById(id: string): Promise<DbUser | null> {
  const [rows] = await db.execute<(DbUser & RowDataPacket)[]>(
    'SELECT `id`, `email`, `passwordHash`, `name`, `role`, `status`, `emailVerified`, `createdAt` FROM `User` WHERE `id` = :id LIMIT 1',
    { id },
  );
  return rows[0] ?? null;
}

async function findSessionByRefreshHash(refreshTokenHash: string): Promise<DbSession | null> {
  const [rows] = await db.execute<(DbSession & RowDataPacket)[]>(
    'SELECT `id`, `userId`, `refreshTokenHash`, `familyId`, `rememberMe`, `revokedAt`, `expiresAt` FROM `Session` WHERE `refreshTokenHash` = :refreshTokenHash LIMIT 1',
    { refreshTokenHash },
  );
  return rows[0] ?? null;
}

function createId(): string {
  return randomUUID().replaceAll('-', '');
}
