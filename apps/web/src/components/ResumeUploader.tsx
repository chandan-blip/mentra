import { useRef, useState } from 'react';
import { FileText, Trash2, Upload } from 'lucide-react';
import { ApiError } from '../lib/api.js';
import { useDeleteResume, useUploadResume } from '../lib/profile.js';

const MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  uploadedAt: string | null;
  hasResume: boolean;
};

export function ResumeUploader({ uploadedAt, hasResume }: Props) {
  const upload = useUploadResume();
  const remove = useDeleteResume();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  function handleFile(file: File | undefined) {
    setError('');
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Resume must be a PDF');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Resume must be 5 MB or smaller');
      return;
    }
    upload.mutate(file, {
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Upload failed'),
    });
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-center transition',
          dragging ? 'border-border-strong bg-surface-sunken' : 'border-border-subtle',
        ].join(' ')}
      >
        {hasResume ? (
          <div className="flex w-full items-center justify-between gap-3 rounded-md bg-surface-sunken p-3 ring-1 ring-border-subtle">
            <span className="flex items-center gap-2 text-sm text-ink">
              <FileText className="size-4 text-ink-muted" />
              Resume.pdf
              {uploadedAt ? (
                <span className="text-xs text-ink-faint">
                  · {new Date(uploadedAt).toLocaleDateString()}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="text-ink-faint hover:text-accent-red"
              aria-label="Delete resume"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ) : (
          <>
            <Upload className="size-5 text-ink-muted" />
            <div className="text-sm text-ink-muted">Drag a PDF here, or</div>
          </>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="mt-1 rounded-md bg-surface-inverse px-3 py-2 text-sm font-medium text-ink-inverse transition hover:bg-ink disabled:opacity-50"
        >
          {upload.isPending ? 'Uploading…' : hasResume ? 'Replace resume' : 'Choose file'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error ? <div className="mt-2 text-xs text-accent-red">{error}</div> : null}
    </div>
  );
}
