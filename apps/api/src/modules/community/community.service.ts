import type {
  CommunityAuthor,
  CommunityCommentView,
  CommunityMemberView,
  CommunityPostView,
  CreateCommentInput,
  CreatePostInput,
  MediaType,
  UpdateCommentInput,
  UpdatePostInput,
} from '@mentra/shared';
import { isUserAdmin } from '../access/access.service.js';
import { createNotification, notifyMany } from '../notification/notification.service.js';
import { CommunityError } from './community.errors.js';
import * as repo from './community.repository.js';

const snippet = (s: string, n = 120): string => (s.length > n ? `${s.slice(0, n)}…` : s);

/**
 * Community feed business logic. Auth-only (every role); authors manage their own
 * posts/comments, admins can pin and delete anything.
 */

function toAuthor(row: { authorId: string; authorName: string; authorRole: string; authorAvatar: string | null }): CommunityAuthor {
  return { id: row.authorId, name: row.authorName, role: row.authorRole, avatarUrl: row.authorAvatar };
}

function toPostView(row: repo.PostRow, userId: string, admin: boolean): CommunityPostView {
  const isMine = row.authorId === userId;
  return {
    id: row.id,
    author: toAuthor(row),
    body: row.body,
    mediaUrl: row.mediaUrl,
    mediaType: (row.mediaType as MediaType | null) ?? null,
    mentions: repo.jsonStringArray(row.mentions),
    pinned: Boolean(row.pinned),
    commentCount: Number(row.commentCount),
    isMine,
    canModerate: isMine || admin,
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toCommentView(row: repo.CommentRow, userId: string, admin: boolean): CommunityCommentView {
  const isMine = row.authorId === userId;
  return {
    id: row.id,
    postId: row.postId,
    author: toAuthor(row),
    body: row.body,
    mentions: repo.jsonStringArray(row.mentions),
    isMine,
    canModerate: isMine || admin,
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

// --- Posts ---

export async function listFeed(userId: string): Promise<CommunityPostView[]> {
  const [rows, admin] = await Promise.all([repo.listPosts(), isUserAdmin(userId)]);
  return rows.map((r) => toPostView(r, userId, admin));
}

export async function createPost(userId: string, input: CreatePostInput): Promise<CommunityPostView> {
  const row = await repo.createPost({
    authorId: userId,
    body: input.body,
    mediaUrl: input.mediaUrl ?? null,
    mediaType: input.mediaType ?? null,
    mentions: input.mentions ?? [],
  });
  await notifyMany((input.mentions ?? []).filter((m) => m !== userId), (uid) => ({
    userId: uid,
    type: 'community.mention',
    title: `${row.authorName} mentioned you`,
    body: snippet(row.body),
    link: '/community',
  }));
  return toPostView(row, userId, await isUserAdmin(userId));
}

export async function updatePost(userId: string, id: string, input: UpdatePostInput): Promise<CommunityPostView> {
  const post = await repo.findPost(id);
  if (!post) throw new CommunityError('POST_NOT_FOUND', 'Post not found', 404);
  const admin = await isUserAdmin(userId);
  if (post.authorId !== userId && !admin) throw new CommunityError('NOT_OWNER', 'You can only edit your own posts', 403);
  await repo.updatePost(id, input);
  const updated = await repo.findPost(id);
  return toPostView(updated!, userId, admin);
}

export async function deletePost(userId: string, id: string): Promise<void> {
  const post = await repo.findPost(id);
  if (!post) return;
  if (post.authorId !== userId && !(await isUserAdmin(userId)))
    throw new CommunityError('NOT_OWNER', 'You can only delete your own posts', 403);
  await repo.deletePost(id);
}

export async function togglePin(userId: string, id: string): Promise<CommunityPostView> {
  if (!(await isUserAdmin(userId))) throw new CommunityError('ADMIN_ONLY', 'Only admins can pin posts', 403);
  const post = await repo.findPost(id);
  if (!post) throw new CommunityError('POST_NOT_FOUND', 'Post not found', 404);
  await repo.setPinned(id, !Boolean(post.pinned));
  const updated = await repo.findPost(id);
  return toPostView(updated!, userId, true);
}

// --- Comments ---

export async function listThread(userId: string, postId: string): Promise<CommunityCommentView[]> {
  const post = await repo.findPost(postId);
  if (!post) throw new CommunityError('POST_NOT_FOUND', 'Post not found', 404);
  const [rows, admin] = await Promise.all([repo.listComments(postId), isUserAdmin(userId)]);
  return rows.map((r) => toCommentView(r, userId, admin));
}

export async function createComment(
  userId: string,
  postId: string,
  input: CreateCommentInput,
): Promise<CommunityCommentView> {
  const post = await repo.findPost(postId);
  if (!post) throw new CommunityError('POST_NOT_FOUND', 'Post not found', 404);
  const row = await repo.createComment({ postId, authorId: userId, body: input.body, mentions: input.mentions ?? [] });
  // Notify the post author (unless they're the commenter).
  if (post.authorId !== userId) {
    await createNotification({
      userId: post.authorId,
      type: 'community.comment',
      title: `${row.authorName} commented on your post`,
      body: snippet(row.body),
      link: '/community',
    });
  }
  // Notify anyone @mentioned (not the commenter, not the already-notified post author).
  await notifyMany(
    (input.mentions ?? []).filter((m) => m !== userId && m !== post.authorId),
    (uid) => ({ userId: uid, type: 'community.mention', title: `${row.authorName} mentioned you`, body: snippet(row.body), link: '/community' }),
  );
  return toCommentView(row, userId, await isUserAdmin(userId));
}

export async function updateComment(
  userId: string,
  id: string,
  input: UpdateCommentInput,
): Promise<CommunityCommentView> {
  const comment = await repo.findComment(id);
  if (!comment) throw new CommunityError('COMMENT_NOT_FOUND', 'Comment not found', 404);
  const admin = await isUserAdmin(userId);
  if (comment.authorId !== userId && !admin)
    throw new CommunityError('NOT_OWNER', 'You can only edit your own comments', 403);
  await repo.updateComment(id, input.body, input.mentions ?? []);
  const updated = await repo.findComment(id);
  return toCommentView(updated!, userId, admin);
}

export async function deleteComment(userId: string, id: string): Promise<void> {
  const comment = await repo.findComment(id);
  if (!comment) return;
  if (comment.authorId !== userId && !(await isUserAdmin(userId)))
    throw new CommunityError('NOT_OWNER', 'You can only delete your own comments', 403);
  await repo.deleteComment(id);
}

// --- Mention autocomplete ---

export async function searchMembers(q: string): Promise<CommunityMemberView[]> {
  const trimmed = q.trim();
  if (trimmed.length === 0) return [];
  return repo.searchMembers(trimmed);
}
