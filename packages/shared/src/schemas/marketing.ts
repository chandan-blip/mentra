import { z } from 'zod';

/**
 * Marketing — channel connections. A marketer connects their LinkedIn / Facebook /
 * email accounts (one per channel); channel pages use the connection. Contract for
 * /api/v1/marketing (marketing-role gated).
 */

export const MarketingChannelSchema = z.enum(['linkedin', 'facebook', 'email']);
export type MarketingChannel = z.infer<typeof MarketingChannelSchema>;

/** Connect (or update) a channel — handle is a profile URL (social) or email address. */
export const connectChannelSchema = z.object({
  channel: MarketingChannelSchema,
  handle: z.string().trim().min(1).max(255),
  displayName: z.string().trim().max(160).optional(),
});
export type ConnectChannelInput = z.infer<typeof connectChannelSchema>;

export type MarketingConnectionView = {
  channel: MarketingChannel;
  handle: string;
  displayName: string | null;
  connectedAt: string;
  /** 'oauth' = real provider connection (e.g. LinkedIn); 'manual' = saved URL/handle. */
  connectedVia: 'oauth' | 'manual';
};

export type LinkedInAuthUrlResponse = { url: string };

/** Publish a post to a connected channel. */
export const createMarketingPostSchema = z.object({
  channel: MarketingChannelSchema,
  body: z.string().trim().min(1).max(3000),
  mediaUrl: z.string().trim().url().max(1024).nullable().optional(),
});
export type CreateMarketingPostInput = z.infer<typeof createMarketingPostSchema>;

export type MarketingPostView = {
  id: string;
  channel: MarketingChannel;
  body: string;
  mediaUrl: string | null;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  /** (likes + comments + shares) / impressions, as a percentage. */
  engagementRate: number;
  /** Public URL of the post on the provider (LinkedIn), if published there. */
  postUrl: string | null;
  postedAt: string;
};
