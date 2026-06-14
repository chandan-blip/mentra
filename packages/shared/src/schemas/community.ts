import { z } from 'zod';

/**
 * Community — a single global feed shared by every role. Anyone signed in can post
 * and comment (rich composer: @mentions, emoji, GIF/image); authors edit/delete
 * their own content and admins pin / delete anything. Contract for /api/v1/community.
 */

export const MediaTypeSchema = z.enum(['image', 'gif']);
export type MediaType = z.infer<typeof MediaTypeSchema>;

const mentions = z.array(z.string().trim().min(1).max(191)).max(50).optional();

export const createPostSchema = z
  .object({
    body: z.string().trim().max(4000).default(''),
    mediaUrl: z.string().trim().url().max(1024).nullable().optional(),
    mediaType: MediaTypeSchema.nullable().optional(),
    mentions,
  })
  .refine((v) => v.body.length > 0 || !!v.mediaUrl, {
    message: 'Add some text or an image/GIF',
    path: ['body'],
  });
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = z.object({
  body: z.string().trim().max(4000).optional(),
  mediaUrl: z.string().trim().url().max(1024).nullable().optional(),
  mediaType: MediaTypeSchema.nullable().optional(),
  mentions,
});
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  mentions,
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  mentions,
});
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

// --- Views ---

export type CommunityAuthor = {
  id: string;
  name: string;
  /** Effective role (student | mentor | admin | accountant | …) for the badge. */
  role: string;
  avatarUrl: string | null;
};

export type CommunityPostView = {
  id: string;
  author: CommunityAuthor;
  body: string;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  mentions: string[];
  pinned: boolean;
  commentCount: number;
  /** True when the requester authored it. */
  isMine: boolean;
  /** True when the requester may edit/delete (author or admin). */
  canModerate: boolean;
  editedAt: string | null;
  createdAt: string;
};

export type CommunityCommentView = {
  id: string;
  postId: string;
  author: CommunityAuthor;
  body: string;
  mentions: string[];
  isMine: boolean;
  canModerate: boolean;
  editedAt: string | null;
  createdAt: string;
};

/** Lightweight user record for @mention autocomplete. */
export type CommunityMemberView = {
  id: string;
  name: string;
  role: string;
};
