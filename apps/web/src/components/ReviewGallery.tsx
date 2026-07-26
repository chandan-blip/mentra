import { Quote, Star } from 'lucide-react';
import type { StudentReviewView } from '@mentra/shared';
import { Card } from '@mentra/ui';

/**
 * Feedbacks & Reviews gallery — the card grid shared by the in-app student page and the
 * public (logged-out) page, so both surfaces always render reviews identically.
 */
export function ReviewGallery({
  reviews,
  isLoading,
}: {
  reviews: StudentReviewView[] | undefined;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <ReviewGrid>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-xl bg-surface-sunken ring-1 ring-border-subtle" />
        ))}
      </ReviewGrid>
    );
  }
  if (!reviews || reviews.length === 0) return <EmptyState />;
  return (
    <ReviewGrid>
      {reviews.map((r) => (
        <ReviewCard key={r.id} review={r} />
      ))}
    </ReviewGrid>
  );
}

function ReviewGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function ReviewCard({ review }: { review: StudentReviewView }) {
  return (
    <Card padding={false} className="flex flex-col overflow-hidden">
      <div className="aspect-video w-full bg-surface-sunken">
        {review.mediaUrl ? (
          review.mediaType === 'video' ? (
            <video
              controls
              preload="metadata"
              poster={review.thumbnailUrl ?? undefined}
              className="h-full w-full bg-black object-contain"
              src={review.mediaUrl}
            />
          ) : (
            <img src={review.mediaUrl} alt={review.title} className="h-full w-full object-cover" />
          )
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">{review.title}</h3>
          {review.studentName ? (
            <span className="shrink-0 text-xs font-medium text-ink-muted">{review.studentName}</span>
          ) : null}
        </div>
        {review.body ? (
          <p className="flex gap-1.5 text-sm text-ink-muted">
            <Quote className="mt-0.5 size-3.5 shrink-0 text-ink-faint" />
            <span className="line-clamp-4">{review.body}</span>
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-sunken py-16 text-center ring-1 ring-border-subtle">
      <Star className="size-7 text-ink-faint" />
      <p className="text-sm text-ink-muted">No reviews yet — check back soon.</p>
    </div>
  );
}
