import { Star } from 'lucide-react';

/** Click-to-rate 1–5 stars. Read-only when `onChange` is omitted. */
export function StarRating({
  score,
  onChange,
  size = 'md',
}: {
  score: number;
  onChange?: (n: number) => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  const px = size === 'lg' ? 'size-8' : size === 'sm' ? 'size-4' : 'size-6';
  const readOnly = !onChange;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = score >= star;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(star)}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            className={`transition ${readOnly ? 'cursor-default' : 'hover:scale-110'}`}
          >
            <Star className={`${px} ${active ? 'fill-accent-amber text-accent-amber' : 'text-ink-faint'}`} />
          </button>
        );
      })}
    </div>
  );
}
