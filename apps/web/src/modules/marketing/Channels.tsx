import { useState, type ComponentType, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { PageHeader } from '../../components/PageHeader.js';
import { useSearchParams } from 'react-router-dom';
import { Check, ExternalLink, Eye, Facebook, Heart, Image as ImageIcon, Link2, Linkedin, Mail, MessageSquare, Plug, RefreshCw, Send, Share2, TrendingUp, X } from 'lucide-react';
import { Badge, Card } from '@mentra/ui';
import type { MarketingChannel, MarketingPostView } from '@mentra/shared';
import {
  formatCount,
  useConnectChannel,
  useConnections,
  useCreateMarketingPost,
  useDisconnectChannel,
  useLinkedInAuthUrl,
  useMarketingPosts,
  useSyncLinkedInStats,
} from '../../lib/marketing.js';

/**
 * Marketing channel pages (LinkedIn / Facebook / Email) and the Connect-profile hub.
 * Each channel is connected by saving a profile URL / email; channel pages then show
 * the connection and (soon) campaign tools. Access is governed by the admin-created
 * modules (e.g. /linkedin, /facebook) like any other module.
 */

type ChannelMeta = {
  channel: MarketingChannel;
  label: string;
  icon: ComponentType<{ className?: string }>;
  handleLabel: string;
  placeholder: string;
  hue: number;
};

const CHANNELS: Record<MarketingChannel, ChannelMeta> = {
  linkedin: { channel: 'linkedin', label: 'LinkedIn', icon: Linkedin, handleLabel: 'Profile / page URL', placeholder: 'https://linkedin.com/company/…', hue: 210 },
  facebook: { channel: 'facebook', label: 'Facebook', icon: Facebook, handleLabel: 'Page URL', placeholder: 'https://facebook.com/…', hue: 220 },
  email: { channel: 'email', label: 'Email', icon: Mail, handleLabel: 'From address', placeholder: 'campaigns@brand.com', hue: 160 },
};

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 28 } },
};

/** A connect/disconnect card for one channel — reused on the hub and channel pages. */
function ChannelConnectCard({ channel }: { channel: MarketingChannel }) {
  const meta = CHANNELS[channel];
  const Icon = meta.icon;
  const isLinkedIn = channel === 'linkedin';
  const connections = useConnections();
  const connect = useConnectChannel();
  const disconnect = useDisconnectChannel();
  const authUrl = useLinkedInAuthUrl();
  const existing = (connections.data ?? []).find((c) => c.channel === channel) ?? null;

  const [editing, setEditing] = useState(false);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!handle.trim()) return;
    setErr(null);
    try {
      await connect.mutateAsync({ channel, handle: handle.trim(), displayName: displayName.trim() || undefined });
      setEditing(false);
      setHandle('');
      setDisplayName('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not connect');
    }
  }

  async function connectLinkedIn() {
    setErr(null);
    try {
      const { url } = await authUrl.mutateAsync();
      window.location.href = url; // top-level redirect to LinkedIn consent
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start LinkedIn sign-in');
    }
  }

  const showManualForm = !isLinkedIn && (editing || (!existing && !connections.isLoading));

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md text-white" style={{ background: `hsl(${meta.hue} 65% 45%)` }}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink">{meta.label}</div>
          {existing ? (
            <div className="truncate text-xs text-ink-faint">{existing.displayName || existing.handle}</div>
          ) : (
            <div className="text-xs text-ink-faint">Not connected</div>
          )}
        </div>
        {existing ? <Badge variant="success" size="sm"><Check className="size-3" /> Connected</Badge> : null}
      </div>

      {err ? <div className="text-xs font-medium text-accent-red">{err}</div> : null}

      {existing ? (
        <div className="flex items-center gap-2">
          {!isLinkedIn ? (
            <button
              type="button"
              onClick={() => {
                setHandle(existing.handle);
                setDisplayName(existing.displayName ?? '');
                setEditing(true);
              }}
              className="h-9 flex-1 rounded-md bg-surface-sunken text-xs font-semibold text-ink ring-1 ring-border-subtle transition hover:ring-border-strong"
            >
              Edit
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => disconnect.mutate(channel)}
            disabled={disconnect.isPending}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold text-ink-muted transition hover:text-accent-red disabled:opacity-50 ${isLinkedIn ? 'flex-1 bg-surface-sunken ring-1 ring-border-subtle' : ''}`}
          >
            <X className="size-3.5" /> Disconnect
          </button>
        </div>
      ) : isLinkedIn ? (
        <button
          type="button"
          onClick={connectLinkedIn}
          disabled={authUrl.isPending}
          className="flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          style={{ background: `hsl(${meta.hue} 65% 45%)` }}
        >
          <Linkedin className="size-4" /> {authUrl.isPending ? 'Redirecting…' : 'Connect with LinkedIn'}
        </button>
      ) : showManualForm ? (
        <div className="space-y-2">
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={meta.placeholder} className="auth-input-plain h-10 w-full text-sm" />
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name (optional)" className="auth-input-plain h-10 w-full text-sm" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!handle.trim() || connect.isPending}
              className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-accent-blue text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
            >
              <Plug className="size-3.5" /> {connect.isPending ? 'Connecting…' : 'Connect'}
            </button>
            {editing ? (
              <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-md px-3 text-xs font-medium text-ink-muted transition hover:text-ink">
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

/** The Connect-profile hub — all channels in one place. */
export function ConnectProfilePage() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-3xl space-y-5"
    >
      <motion.div variants={fadeUp}>
        <PageHeader
          icon={<Link2 />}
          title="Connect profiles"
          subtitle="Link your marketing accounts so you can publish and track from each channel."
        />
      </motion.div>

      <motion.div variants={fadeUp} className="grid gap-4 sm:grid-cols-2">
        <ChannelConnectCard channel="linkedin" />
        <ChannelConnectCard channel="facebook" />
        <ChannelConnectCard channel="email" />
      </motion.div>
    </motion.div>
  );
}

/** A single channel page: connect → compose a post → see posts with engagement. */
function ChannelPage({ channel }: { channel: MarketingChannel }) {
  const meta = CHANNELS[channel];
  const Icon = meta.icon;
  const connections = useConnections();
  const connected = (connections.data ?? []).some((c) => c.channel === channel);
  const [params] = useSearchParams();
  const oauthResult = channel === 'linkedin' ? (params.get('connected') ? 'ok' : params.get('error')) : null;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
      className="mx-auto w-full max-w-3xl space-y-5"
    >
      <motion.div variants={fadeUp}>
        <PageHeader
          icon={<Icon />}
          title={meta.label}
          subtitle={`Post to ${meta.label} and track engagement — all from here.`}
        />
      </motion.div>

      {oauthResult === 'ok' ? (
        <motion.div variants={fadeUp}>
          <Card className="flex items-center gap-2 text-sm text-accent-green"><Check className="size-4" /> LinkedIn connected.</Card>
        </motion.div>
      ) : oauthResult ? (
        <motion.div variants={fadeUp}>
          <Card className="text-sm text-accent-red">Couldn’t connect LinkedIn. Please try again.</Card>
        </motion.div>
      ) : null}

      <motion.div variants={fadeUp}>
        <ChannelConnectCard channel={channel} />
      </motion.div>

      {connected ? (
        <>
          <motion.div variants={fadeUp}>
            <PostComposer channel={channel} label={meta.label} />
          </motion.div>
          <motion.div variants={fadeUp}>
            <PostsFeed channel={channel} />
          </motion.div>
        </>
      ) : (
        <motion.div variants={fadeUp}>
          <Card className="text-sm text-ink-muted">Connect your {meta.label} profile above to start posting.</Card>
        </motion.div>
      )}
    </motion.div>
  );
}

/** Compose + publish a post to the connected channel. */
function PostComposer({ channel, label }: { channel: MarketingChannel; label: string }) {
  const create = useCreateMarketingPost();
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [showMedia, setShowMedia] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function publish() {
    if (!body.trim()) return;
    setErr(null);
    try {
      await create.mutateAsync({ channel, body: body.trim(), mediaUrl: mediaUrl.trim() || undefined });
      setBody('');
      setMediaUrl('');
      setShowMedia(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not publish');
    }
  }

  return (
    <Card className="space-y-3">
      <div className="text-sm font-medium text-ink">Create a post</div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={`Write your ${label} post…`}
        className="auth-input-plain w-full resize-none py-2 text-sm"
      />
      {showMedia ? (
        <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="Image URL (optional)" className="auth-input-plain h-9 w-full text-sm" />
      ) : null}
      {mediaUrl ? <img src={mediaUrl} alt="preview" className="max-h-48 rounded-md ring-1 ring-border-subtle" /> : null}
      {err ? <div className="text-xs font-medium text-accent-red">{err}</div> : null}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowMedia((v) => !v)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-ink-muted transition hover:bg-surface-sunken hover:text-ink"
        >
          <ImageIcon className="size-4" /> Image
        </button>
        <button
          type="button"
          onClick={publish}
          disabled={!body.trim() || create.isPending}
          className="flex h-9 items-center gap-1.5 rounded-md bg-accent-blue px-4 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        >
          <Send className="size-3.5" /> {create.isPending ? 'Posting…' : 'Post'}
        </button>
      </div>
    </Card>
  );
}

/** List of the channel's posts with engagement stats. */
function PostsFeed({ channel }: { channel: MarketingChannel }) {
  const posts = useMarketingPosts(channel);
  const sync = useSyncLinkedInStats();
  const isLinkedIn = channel === 'linkedin';

  if (posts.isLoading) return <Card className="text-sm text-ink-muted">Loading posts…</Card>;
  const data = posts.data ?? [];
  if (data.length === 0) return <Card className="text-sm text-ink-muted">No posts yet — publish your first one above.</Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-ink">Your posts</div>
        {isLinkedIn ? (
          <button
            type="button"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-muted transition hover:bg-surface-sunken hover:text-ink disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${sync.isPending ? 'animate-spin' : ''}`} /> Refresh stats
          </button>
        ) : null}
      </div>
      {data.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}

function PostCard({ post: p }: { post: MarketingPostView }) {
  const isLinkedIn = p.channel === 'linkedin';
  return (
    <Card className="space-y-3 p-4">
      <div className="whitespace-pre-wrap break-words text-sm leading-6 text-ink">{p.body}</div>
      {p.mediaUrl ? <img src={p.mediaUrl} alt="post" className="max-h-72 rounded-md ring-1 ring-border-subtle" /> : null}
      <div className="text-xs text-ink-faint">{formatWhen(p.postedAt)}</div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-subtle pt-3 text-xs text-ink-muted">
        {isLinkedIn ? (
          <>
            <Stat icon={<Heart className="size-3.5" />} value={formatCount(p.likes)} label="likes" />
            <Stat icon={<MessageSquare className="size-3.5" />} value={formatCount(p.comments)} label="comments" />
            {p.postUrl ? (
              <a href={p.postUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-medium text-accent-blue hover:underline">
                <ExternalLink className="size-3.5" /> View on LinkedIn
              </a>
            ) : null}
          </>
        ) : (
          <>
            <Stat icon={<Eye className="size-3.5" />} value={formatCount(p.impressions)} label="impressions" />
            <Stat icon={<Heart className="size-3.5" />} value={formatCount(p.likes)} label="likes" />
            <Stat icon={<MessageSquare className="size-3.5" />} value={formatCount(p.comments)} label="comments" />
            <Stat icon={<Share2 className="size-3.5" />} value={formatCount(p.shares)} label="shares" />
            <span className="ml-auto inline-flex items-center gap-1 font-medium text-accent-green">
              <TrendingUp className="size-3.5" /> {p.engagementRate}% engagement
            </span>
          </>
        )}
      </div>
    </Card>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      {icon}
      <span className="font-medium text-ink">{value}</span>
    </span>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }).format(d);
}

export function LinkedInPage() {
  return <ChannelPage channel="linkedin" />;
}
export function FacebookPage() {
  return <ChannelPage channel="facebook" />;
}
export function EmailPage() {
  return <ChannelPage channel="email" />;
}
