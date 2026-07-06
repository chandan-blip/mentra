import { Readable } from 'node:stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env.js';

/**
 * Cloudflare R2 (S3-compatible) object storage for Live Session recordings.
 *
 * Distinct from `core/storage.ts` (local-disk resumes/avatars): video is large and
 * must be CDN-served, so it lives in R2. LiveKit Egress writes the raw composite here
 * directly; the FFmpeg transcode worker reads it back, then writes the HLS ladder
 * (`.m3u8` + `.ts`) here too. The public CDN domain (`R2_PUBLIC_BASE_URL`) fronts the
 * bucket for playback — the credentials below are never exposed to the browser.
 *
 * The pipeline is gated on `r2Enabled()`: with no creds the app still boots and the
 * recordings feature simply stays off (same pattern as the LinkedIn/Vapi integrations).
 */

/** True when R2 is fully configured (endpoint + keys + bucket). */
export function r2Enabled(): boolean {
  return Boolean(
    env.R2_ENDPOINT && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET,
  );
}

let client: S3Client | null = null;

/** Lazily-built singleton S3 client. Throws if R2 isn't configured — callers gate on r2Enabled(). */
export function r2(): S3Client {
  if (!r2Enabled()) {
    throw new Error('R2 is not configured (set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET)');
  }
  if (!client) {
    client = new S3Client({
      region: env.R2_REGION || 'auto',
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      // R2 requires path-style addressing (no virtual-hosted bucket subdomains).
      forcePathStyle: true,
    });
  }
  return client;
}

const BUCKET = () => env.R2_BUCKET;

/**
 * Public CDN URL for a stored object key, or null when no public base is configured.
 * Keys are stored without a leading slash; the base has none trailing.
 */
export function publicUrl(key: string): string | null {
  const base = env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '');
  if (!base) return null;
  return `${base}/${key.replace(/^\/+/, '')}`;
}

/** Upload a buffer/stream. Uses multipart under the hood so large MP4s stream safely. */
export async function r2Put(
  key: string,
  body: Buffer | Readable | Uint8Array,
  contentType?: string,
): Promise<void> {
  const upload = new Upload({
    client: r2(),
    params: { Bucket: BUCKET(), Key: key, Body: body, ContentType: contentType },
  });
  await upload.done();
}

/** Small-object convenience (e.g. an .m3u8 playlist or JSON sidecar). */
export async function r2PutText(key: string, text: string, contentType: string): Promise<void> {
  await r2().send(
    new PutObjectCommand({ Bucket: BUCKET(), Key: key, Body: text, ContentType: contentType }),
  );
}

/** Download an object as a Buffer (the worker pulls the raw recording this way). */
export async function r2Get(key: string): Promise<Buffer> {
  const res = await r2().send(new GetObjectCommand({ Bucket: BUCKET(), Key: key }));
  const stream = res.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** Stream an object (for piping into ffmpeg without buffering the whole file). */
export async function r2GetStream(key: string): Promise<Readable> {
  const res = await r2().send(new GetObjectCommand({ Bucket: BUCKET(), Key: key }));
  return res.Body as Readable;
}

export type R2Head = { exists: boolean; size: number; contentType?: string };

export async function r2Head(key: string): Promise<R2Head> {
  try {
    const res = await r2().send(new HeadObjectCommand({ Bucket: BUCKET(), Key: key }));
    return { exists: true, size: res.ContentLength ?? 0, contentType: res.ContentType };
  } catch {
    return { exists: false, size: 0 };
  }
}

/** List object keys under a prefix (e.g. all segments for a recording). Handles pagination. */
export async function r2List(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const res = await r2().send(
      new ListObjectsV2Command({ Bucket: BUCKET(), Prefix: prefix, ContinuationToken: token }),
    );
    for (const obj of res.Contents ?? []) if (obj.Key) keys.push(obj.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

export async function r2Delete(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }));
}

/**
 * Presigned PUT URL so the browser uploads a large file straight to R2 (no proxying
 * through the API). The bucket must allow PUT from the web origin via a CORS rule.
 * Note: a plain presigned PUT can't bind a max size — enforce that client-side and
 * re-check the object size server-side after upload (see finalizeUpload).
 */
export async function presignPut(
  key: string,
  contentType: string,
  expiresSeconds = 60 * 60,
): Promise<string> {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: BUCKET(), Key: key, ContentType: contentType }),
    { expiresIn: expiresSeconds },
  );
}
