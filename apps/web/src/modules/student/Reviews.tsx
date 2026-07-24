import { Quote, Star } from 'lucide-react';
import type { StudentReviewView } from '@mentra/shared';
import { Card } from '@mentra/ui';
import { useReviews } from '../../lib/reviews.js';

/**
 * Feedbacks & Reviews (student). A gallery of review videos and screenshots uploaded by
 * managers — social proof from other students. Read-only.
 */
export function ReviewsPage() {
  const { data: reviews, isLoading } = useReviews();

  return (
    <div className="mx-auto w-full max-w-8xl pt-4 md:pt-0">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-accent-amber ring-1 ring-border-subtle">
          <Star className="size-5" />
        </span>
        <div>
          <h1 className="text-display-sm tracking-normal md:text-display-md">Feedbacks &amp; Reviews</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            Real feedback from students who’ve been through the program.
          </p>
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <ReviewGrid>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 animate-pulse rounded-xl bg-surface-sunken ring-1 ring-border-subtle" />
            ))}
          </ReviewGrid>
        ) : !reviews || reviews.length === 0 ? (
          <EmptyState />
        ) : (
          <ReviewGrid>
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </ReviewGrid>
        )}
      </div>
    </div>
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
