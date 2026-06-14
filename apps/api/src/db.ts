import mysql from 'mysql2/promise';
import { env } from './env.js';

export const db = mysql.createPool({
  uri: env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

/**
 * Values accepted by a mysql2 named-placeholder (`:name`) params object. Use this for
 * the dynamic `params` builders in repositories — `Record<string, unknown>` is NOT
 * assignable to mysql2's `ExecuteValues`, since `unknown` isn't a valid bind value.
 */
export type SqlParams = Record<string, string | number | boolean | Date | null>;

export type DbUser = {
  id: string;
  email: string;
  passwordHash: string | null;
  name: string;
  role: 'student' | 'mentor' | 'admin';
  status: 'pending' | 'active' | 'suspended';
  emailVerified: 0 | 1 | boolean;
  createdAt: Date;
};

export type DbSession = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  familyId: string;
  rememberMe: 0 | 1 | boolean;
  revokedAt: Date | null;
  expiresAt: Date;
};
