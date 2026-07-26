import { Link } from 'react-router-dom';
import { ReviewGallery } from '../../components/ReviewGallery.js';
import { usePublicReviews } from '../../lib/reviews.js';

/**
 * Public, no-auth Feedbacks & Reviews gallery (`/reviews`). Reviews are social proof, so
 * anyone can browse them without an account — signed-in users get the same gallery inside
 * the app shell (modules/student/Reviews) at this same URL.
 */
export function PublicReviewsPage() {
  const { data: reviews, isLoading } = usePublicReviews();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="text-lg font-extrabold tracking-tight text-ink">
          Mentra<span className="text-accent-red">.</span>
        </Link>
        <Link
          to="/auth"
          className="rounded-full bg-surface-inverse px-4 py-1.5 text-sm font-semibold text-ink-inverse transition hover:bg-ink"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-8xl px-4 pb-16 sm:px-6">
        <div className="py-6 text-center sm:py-10">
          <h1 className="text-display-sm tracking-normal md:text-display-md">Feedbacks &amp; Reviews</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-muted">
            Real feedback from students who’ve been through the program.
          </p>
        </div>

        <ReviewGallery reviews={reviews} isLoading={isLoading} />

        <div className="mt-10 rounded-lg bg-surface-sunken p-4 text-center text-sm text-ink-muted">
          Want the full experience — roadmaps, live sessions and more?{' '}
          <Link to="/auth" className="font-semibold text-ink underline">
            Join Mentra
          </Link>
        </div>
      </main>
    </div>
  );
}
