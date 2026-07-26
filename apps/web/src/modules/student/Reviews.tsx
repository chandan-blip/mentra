import { Star } from 'lucide-react';
import { ReviewGallery } from '../../components/ReviewGallery.js';
import { useReviews } from '../../lib/reviews.js';

/**
 * Feedbacks & Reviews (student). A gallery of review videos and screenshots uploaded by
 * managers — social proof from other students. Read-only. Logged-out visitors get the same
 * gallery without the app shell at the same URL (see modules/public/PublicReviews).
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
        <ReviewGallery reviews={reviews} isLoading={isLoading} />
      </div>
    </div>
  );
}
