import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, Pin, Pencil, Trash2, Users, X } from 'lucide-react';
import { Avatar, Badge, Card } from '@mentra/ui';
import type { CommunityCommentView, CommunityPostView } from '@mentra/shared';
import { RichComposer, renderRichText, type ComposerValue } from '../../components/RichComposer.js';
import { getStoredUser, resolveAvatarUrl } from '../../lib/auth.js';
import { useProfile } from '../../lib/profile.js';
import { useHideChromeOnScroll } from '../../lib/chrome.js';
import {
  formatAgo,
  useComments,
  useCreateComment,
  useCreatePost,
  useDeleteComment,
  useDeletePost,
  usePosts,
  useUpdatePost,
} from '../../lib/community.js';

/**
 * Community — a single global feed shared by every role. Anyone signed in can post
 * (text + emoji + @mentions + image/GIF) and comment; authors edit/delete their own,
 * admins pin and delete anything.
 */

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

export function CommunityPage() {
  const posts = usePosts();
  const createPost = useCreatePost();
  const [composerOpen, setComposerOpen] = useState(false);

  // Current user, for the mobile composer-trigger avatar.
  const { data: me } = useProfile();
  const avatarSrc = resolveAvatarUrl(me?.profile?.avatarUrl);
  const displayName = getStoredUser()?.name ?? '';

  // Hide the app chrome (top bar + bottom nav) while scrolling the feed down.
  const feedRef = useRef<HTMLDivElement>(null);
  useHideChromeOnScroll(feedRef);

  async function submitPost(v: ComposerValue) {
    await createPost.mutateAsync({ body: v.body, mediaUrl: v.mediaUrl, mediaType: v.mediaType, mentions: v.mentions });
  }

  // Mobile: h-[calc(100%+6rem)] + -mb-24 reclaims the shell's bottom-nav padding so the
  // feed fills the full height; the feed pads its own scroll content to clear the nav.
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto flex h-[calc(100%+6rem)] w-full max-w-2xl flex-col -mb-24 md:h-full md:mb-0"
    >
      {/* Fixed header */}
      <motion.div variants={fadeUp} className="shrink-0">
        {/* Desktop: icon + title (hidden on mobile — the app top bar already names the page) */}
        <div className="hidden items-center justify-between gap-2 md:flex">
          <h1 className="flex items-center gap-3 text-display-md tracking-normal">
            <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-surface-inverse text-ink-inverse [&_svg]:size-7">
              <Users />
            </span>
            Community
          </h1>
          <Link
            to="/students"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-surface-sunken px-4 text-sm font-semibold text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
          >
            <Users className="size-4" /> Browse students
          </Link>
        </div>
        <p className="mt-1 hidden text-sm text-ink-muted md:block">
          Share wins, ask questions, help each other — everyone's here.
        </p>

        {/* Mobile: avatar + tappable input that opens the post composer bottom sheet */}
        <div className="flex items-center gap-3 md:hidden">
          <Avatar src={avatarSrc} name={displayName} size="md" />
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="flex-1 rounded-full bg-surface-sunken px-4 py-2.5 text-left text-sm text-ink-faint ring-1 ring-border-subtle transition hover:ring-border-strong"
          >
            What's on your mind?
          </button>
        </div>
      </motion.div>

      {/* Fixed post composer — desktop only (mobile uses the bottom sheet) */}
      <motion.div variants={fadeUp} className="mt-5 hidden shrink-0 md:block">
        <RichComposer
          placeholder="Share something with the community…"
          submitLabel="Post"
          pending={createPost.isPending}
          onSubmit={submitPost}
        />
      </motion.div>

      {/* Scrollable feed — only the posts scroll */}
      <div ref={feedRef} className="mt-5 min-h-0 flex-1 overflow-y-auto pb-24 pr-1 md:pb-4">
        {posts.isLoading ? (
          <Card className="text-sm text-ink-muted">Loading the feed…</Card>
        ) : (posts.data?.length ?? 0) === 0 ? (
          <Card className="text-sm text-ink-muted">No posts yet — be the first to say hi 👋</Card>
        ) : (
          <motion.div variants={fadeUp} className="space-y-4">
            {posts.data!.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </motion.div>
        )}
      </div>

      {/* Mobile post-composer bottom sheet */}
      <AnimatePresence>
        {composerOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setComposerOpen(false)}
            />
            <motion.div
              className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-canvas p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] ring-1 ring-border-subtle"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border-strong/60" />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">New post</h2>
                <button
                  type="button"
                  onClick={() => setComposerOpen(false)}
                  aria-label="Close"
                  className="grid size-8 place-items-center rounded-md text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
                >
                  <X className="size-4" />
                </button>
              </div>
              <RichComposer
                placeholder="Share something with the community…"
                submitLabel="Post"
                pending={createPost.isPending}
                onSubmit={async (v) => {
                  await submitPost(v);
                  setComposerOpen(false);
                }}
                onCancel={() => setComposerOpen(false)}
              />
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function PostCard({ post: p }: { post: CommunityPostView }) {
  const update = useUpdatePost();
  const del = useDeletePost();
  const [editing, setEditing] = useState(false);
  const [showComments, setShowComments] = useState(false);

  async function saveEdit(v: ComposerValue) {
    await update.mutateAsync({
      id: p.id,
      input: { body: v.body, mediaUrl: v.mediaUrl, mediaType: v.mediaType, mentions: v.mentions },
    });
    setEditing(false);
  }

  return (
    <Card padding={false} className={`p-4 ${p.pinned ? 'ring-1 ring-accent-amber/40' : ''}`}>
      <div className="flex items-center gap-3">
        <Link to={`/students/${p.author.id}`} aria-label={`View ${p.author.name}'s profile`}>
          <Avatar src={p.author.avatarUrl ?? undefined} name={p.author.name} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link to={`/students/${p.author.id}`} className="truncate text-sm font-semibold text-ink hover:underline">
              {p.author.name}
            </Link>
            <RoleBadge role={p.author.role} />
            <span className="text-xs text-ink-faint">· {formatAgo(p.createdAt)}{p.editedAt ? ' · edited' : ''}</span>
            {p.pinned ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-amber">
                <Pin className="size-3" /> Pinned
              </span>
            ) : null}
          </div>
        </div>
        <PostActions post={p} onEdit={() => setEditing((v) => !v)} onDelete={() => del.mutate(p.id)} />
      </div>

      {editing ? (
        <div className="mt-3">
          <RichComposer
            submitLabel="Save"
            pending={update.isPending}
            initial={{ body: p.body, mediaUrl: p.mediaUrl, mediaType: p.mediaType, mentions: p.mentions }}
            onSubmit={saveEdit}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <>
          {p.body ? <PostBody body={p.body} /> : null}
          {p.mediaUrl ? <img src={p.mediaUrl} alt="post media" loading="lazy" decoding="async" className="mt-3 max-h-96 rounded-md ring-1 ring-border-subtle" /> : null}
        </>
      )}

      <div className="mt-3 flex items-center gap-3 border-t border-border-subtle pt-2">
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted transition hover:text-ink"
        >
          <MessageSquare className="size-4" /> {p.commentCount} {p.commentCount === 1 ? 'comment' : 'comments'}
        </button>
      </div>

      {showComments ? <CommentThread postId={p.id} /> : null}
    </Card>
  );
}

/** Max rendered height (px) of a collapsed post body before it's clamped with a "Show more". */
const POST_COLLAPSED_MAX = 320;

/**
 * Post body that clamps long content to a fixed max height with a fade + "Show more"
 * toggle. The toggle only appears when the content actually overflows the cap (measured
 * against the element's full scrollHeight, re-checked on reflow).
 */
function PostBody({ body }: { body: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // scrollHeight reflects the full content height even while max-height clamps it.
    const check = () => setOverflowing(el.scrollHeight > POST_COLLAPSED_MAX + 8);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [body]);

  const clamped = overflowing && !expanded;

  return (
    <div className="mt-2">
      <div
        ref={ref}
        className="relative overflow-hidden whitespace-pre-wrap break-words text-sm leading-6 text-ink"
        style={{ maxHeight: clamped ? POST_COLLAPSED_MAX : undefined }}
      >
        {renderRichText(body)}
        {clamped ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-surface to-transparent" />
        ) : null}
      </div>
      {overflowing ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-semibold text-ink-muted transition hover:text-ink"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}

function PostActions({
  post: p,
  onEdit,
  onDelete,
}: {
  post: CommunityPostView;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {p.isMine ? (
        <IconBtn label="Edit" onClick={onEdit}>
          <Pencil className="size-4" />
        </IconBtn>
      ) : null}
      {p.canModerate ? (
        <IconBtn label="Delete" onClick={onDelete} danger>
          <Trash2 className="size-4" />
        </IconBtn>
      ) : null}
    </div>
  );
}

function CommentThread({ postId }: { postId: string }) {
  const comments = useComments(postId);
  const create = useCreateComment();
  const del = useDeleteComment(postId);

  return (
    <div className="mt-3 space-y-3 border-t border-border-subtle pt-3">
      {comments.isLoading ? (
        <div className="text-xs text-ink-faint">Loading comments…</div>
      ) : (
        (comments.data ?? []).map((c) => <CommentRow key={c.id} comment={c} onDelete={() => del.mutate(c.id)} />)
      )}

      <RichComposer
        placeholder="Write a comment…"
        submitLabel="Comment"
        withMedia={false}
        pending={create.isPending}
        onSubmit={async (v) => {
          await create.mutateAsync({ postId, input: { body: v.body, mentions: v.mentions } });
        }}
      />
    </div>
  );
}

function CommentRow({ comment: c, onDelete }: { comment: CommunityCommentView; onDelete: () => void }) {
  return (
    <div className="flex items-start gap-2">
      <Link to={`/students/${c.author.id}`} aria-label={`View ${c.author.name}'s profile`}>
        <Avatar src={c.author.avatarUrl ?? undefined} name={c.author.name} size="sm" />
      </Link>
      <div className="min-w-0 flex-1 rounded-lg bg-surface-sunken px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-2">
          <Link to={`/students/${c.author.id}`} className="truncate text-xs font-semibold text-ink hover:underline">
            {c.author.name}
          </Link>
          <RoleBadge role={c.author.role} />
          <span className="text-[11px] text-ink-faint">· {formatAgo(c.createdAt)}</span>
        </div>
        <div className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-5 text-ink">{renderRichText(c.body)}</div>
      </div>
      {c.canModerate ? (
        <IconBtn label="Delete" onClick={onDelete} danger>
          <Trash2 className="size-3.5" />
        </IconBtn>
      ) : null}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const variant = role === 'admin' ? 'danger' : role === 'mentor' ? 'success' : role === 'accountant' ? 'info' : 'outline';
  return (
    <Badge variant={variant} size="sm">
      <span className="capitalize">{role}</span>
    </Badge>
  );
}

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-8 place-items-center rounded-md text-ink-muted transition hover:bg-surface-sunken ${danger ? 'hover:text-accent-red' : 'hover:text-ink'}`}
    >
      {children}
    </button>
  );
}
