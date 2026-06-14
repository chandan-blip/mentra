import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { env } from '../env.js';

/**
 * Local-disk object storage. Files live under RESUME_STORAGE_DIR, keyed by a
 * path like `resumes/<userId>/<uuid>.pdf`. In dev this sits on the bind-mounted
 * repo dir so uploads survive container restarts. Swap this module for an
 * S3/MinIO client if remote storage is needed later — the interface is stable.
 */
const root = resolve(env.RESUME_STORAGE_DIR);

function pathForKey(key: string): string {
  const full = resolve(root, key);
  // Guard against path traversal (`../`) escaping the storage root.
  if (full !== root && !full.startsWith(root + sep)) {
    throw new Error('invalid storage key');
  }
  return full;
}

export async function saveObject(key: string, body: Buffer): Promise<void> {
  const full = pathForKey(key);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, body);
}

export type ObjectHead = { exists: boolean; size: number };

export async function headObject(key: string): Promise<ObjectHead> {
  try {
    const info = await stat(pathForKey(key));
    return { exists: info.isFile(), size: info.size };
  } catch {
    return { exists: false, size: 0 };
  }
}

export async function readObject(key: string): Promise<Buffer> {
  return readFile(pathForKey(key));
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await unlink(pathForKey(key));
  } catch (err) {
    // Already gone is fine; rethrow anything else.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
