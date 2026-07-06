import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Avatar } from '@mentra/ui';
import { ApiError } from '../lib/api.js';
import { resolveAvatarUrl } from '../lib/auth.js';
import { useDeleteAvatar, useUploadAvatar } from '../lib/profile.js';

const MAX_BYTES = 2 * 1024 * 1024;
const ACCEPT = ['image/png', 'image/jpeg', 'image/webp'];

type Props = {
  /** Current avatar URL (servable), or null for the initials fallback. */
  currentUrl: string | null;
  /** Used for the initials fallback + alt text. */
  name: string;
  /** Called with the new URL after a successful upload, or null after removal. */
  onChange?: (url: string | null) => void;
};

/**
 * Upload / replace / remove a profile picture. Posts the image straight to the API
 * (same pattern as ResumeUploader) and reports the new servable URL via onChange.
 */
export function AvatarUploader({ currentUrl, name, onChange }: Props) {
  const upload = useUploadAvatar();
  const remove = useDeleteAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  function handleFile(file: File | undefined) {
    setError('');
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      setError('Use a PNG, JPEG or WebP image');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be 2 MB or smaller');
      return;
    }
    upload.mutate(file, {
      onSuccess: (res) => onChange?.(res.avatarUrl),
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Upload failed'),
    });
  }

  return (
    <div className="flex items-center gap-4">
      {/* Both actions live on the avatar: camera (upload/replace) bottom-right,
          delete top-right (only when a photo is set). */}
      <div className="relative">
        <Avatar src={resolveAvatarUrl(currentUrl)} name={name} size="2xl" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          aria-label={currentUrl ? 'Replace profile picture' : 'Upload profile picture'}
          title={currentUrl ? 'Replace photo' : 'Upload photo'}
          className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-surface-inverse text-ink-inverse ring-2 ring-canvas transition hover:bg-ink disabled:opacity-50"
        >
          <Camera className="size-4" />
        </button>
        {currentUrl ? (
          <button
            type="button"
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => onChange?.(null),
                onError: (err) => setError(err instanceof ApiError ? err.message : 'Remove failed'),
              })
            }
            disabled={remove.isPending}
            aria-label="Remove profile picture"
            title="Remove photo"
            className="absolute -top-1 -right-1 grid size-8 place-items-center rounded-full bg-surface text-ink-faint ring-2 ring-canvas transition hover:text-accent-red disabled:opacity-50"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-ink">
          {upload.isPending ? 'Uploading…' : remove.isPending ? 'Removing…' : currentUrl ? 'Profile photo' : 'Add a profile photo'}
        </p>
        <p className="text-xs text-ink-faint">PNG, JPEG or WebP · up to 2 MB</p>
        {error ? <p className="text-xs text-accent-red">{error}</p> : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(',')}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
