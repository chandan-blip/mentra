import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, Pin, PinOff, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { Avatar, Badge, Card } from '@mentra/ui';
import type { CommunityCommentView, CommunityPostView } from '@mentra/shared';
import { RichComposer, renderRichText, type ComposerValue } from '../../components/RichComposer.js';
import {
  formatAgo,
  useComments,
  useCreateComment,
  useCreatePost,
  useDeleteComment,
  useDeletePost,
  usePosts,
  useTogglePin,
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

  async function submitPost(v: ComposerValue) {
    await createPost.mutateAsync({ body: v.body, mediaUrl: v.mediaUrl, mediaType: v.mediaType, mentions: v.mentions });
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto flex h-full w-full max-w-2xl flex-col"
    >
      {/* Fixed header */}
      <motion.div variants={fadeUp} className="shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-3 text-display-md tracking-normal">
            <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-surface-inverse text-ink-inverse [&_svg]:size-7">
              <Users />
            </span>
            Community
          </h1>
          {/* Mobile-only: open the post composer as a bottom sheet */}
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            aria-label="Create post"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-inverse text-ink-inverse transition hover:bg-ink md:hidden"
          >
            <Plus className="size-5" />
          </button>
        </div>
        <p className="mt-1 hidden text-sm text-ink-muted md:block">
          Share wins, ask questions, help each other — everyone's here.
        </p>
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
      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pb-4 pr-1">
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
  const pin = useTogglePin();
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
    <Card className={`p-4 ${p.pinned ? 'ring-1 ring-accent-amber/40' : ''}`}>
      <div className="flex items-center gap-3">
        <Avatar src={p.author.avatarUrl ?? undefined} name={p.author.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-sm font-semibold text-ink">{p.author.name}</span>
            <RoleBadge role={p.author.role} />
            <span className="text-xs text-ink-faint">· {formatAgo(p.createdAt)}{p.editedAt ? ' · edited' : ''}</span>
            {p.pinned ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-amber">
                <Pin className="size-3" /> Pinned
              </span>
            ) : null}
          </div>
        </div>
        <PostActions post={p} onEdit={() => setEditing((v) => !v)} onDelete={() => del.mutate(p.id)} onPin={() => pin.mutate(p.id)} />
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
          {p.body ? (
            <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-ink">{renderRichText(p.body)}</div>
          ) : null}
          {p.mediaUrl ? <img src={p.mediaUrl} alt="post media" className="mt-3 max-h-96 rounded-md ring-1 ring-border-subtle" /> : null}
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

function PostActions({
  post: p,
  onEdit,
  onDelete,
  onPin,
}: {
  post: CommunityPostView;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {p.canModerate ? (
        <IconBtn label="Pin" onClick={onPin}>
          {p.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
        </IconBtn>
      ) : null}
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
      <Avatar src={c.author.avatarUrl ?? undefined} name={c.author.name} size="sm" />
      <div className="min-w-0 flex-1 rounded-lg bg-surface-sunken px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="truncate text-xs font-semibold text-ink">{c.author.name}</span>
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
