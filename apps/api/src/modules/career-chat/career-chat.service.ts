import type {
  CareerChatMessageView,
  CareerChatSessionCard,
  EnrollCareerChatInput,
  SendCareerChatInput,
} from '@mentra/shared';
import { AiError } from '../../core/ai.js';
import { logger } from '../../logger.js';
import { getProfile } from '../user-profile/index.js';
import * as liveRepo from '../live-session/live-session.repository.js';
import { generateCoachReply, type HistoryTurn } from './career-chat.ai.js';
import { CareerChatError } from './career-chat.errors.js';
import * as repo from './career-chat.repository.js';

/** Module key gating the student chat surface (matches the frontend AppLayout guard). */
export const CHAT_MODULE = 'career-chat';

/**
 * The coach persona. This is a friendly product mentor identity — deliberately not a
 * specific real mentor account — so the chat reads as human without impersonating a
 * real user. Live-session invites are separately attributed to the real host.
 */
const COACH = { name: 'Arjun Mehta' };

/**
 * How many past turns of the student's (single, persistent) thread to feed the coach.
 * The whole conversation is stored in `CareerChatMessage` keyed by userId, so this is a
 * continuous memory across sessions — a wide window lets the coach recall what the
 * student told them days ago and build a real picture of them over time.
 */
const HISTORY_WINDOW = 60;

const ENROLL_COMMENT = 'Enrolled! 🎉 Looking forward to it.';
const INVITE_LINE = "One more thing — there's a live session coming up that fits this really well. Want to join?";

/**
 * Sent when the AI reply fails (after retries). Rather than leave the student staring at
 * silence, the coach drops one of these human-sounding "I'll get back to you" notes so
 * every message gets an acknowledgement (see `busyReply`).
 */
const BUSY_REPLIES = [
  "Hey, I'm tied up with another mentee right now — I'll get back to you on this properly in a bit, promise 🙏",
  "Sorry, I'm in the middle of something at the moment. Give me a little while and I'll reply properly.",
  "Caught up with a few things right now — I haven't forgotten you, I'll come back to this soon.",
  'Bear with me, a bit swamped just now. I’ll pick this up with you shortly.',
];

const iso = (d: Date | null): string | null => (d ? new Date(d).toISOString() : null);
const firstName = (name: string | null): string => (name ? (name.trim().split(/\s+/)[0] ?? '') : '');
/** Normalize a message for equality checks (whitespace/case-insensitive). */
const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

// --- Reads ---

/** The full conversation as views (seeds the opening greeting on first visit). */
export async function getConversation(userId: string): Promise<CareerChatMessageView[]> {
  await ensureSeeded(userId);
  const rows = await repo.listByUser(userId);
  return buildViews(userId, rows);
}

// --- Writes ---

export async function sendMessage(
  userId: string,
  input: SendCareerChatInput,
): Promise<CareerChatMessageView[]> {
  await ensureSeeded(userId);
  const studentRow = await repo.insertMessage({ userId, role: 'student', kind: 'text', body: input.body });
  // Only the rows created by THIS turn — the client appends these to its cache rather
  // than reloading the whole thread on every message.
  const created: repo.CareerChatRow[] = [studentRow];

  // History (oldest-first, capped) after the student's new turn is stored. This is the
  // full persistent thread, so the coach picks up context from earlier sessions too.
  const rows = await repo.listByUser(userId);
  const history = await buildHistory(userId, rows.slice(-HISTORY_WINDOW));

  try {
    const reply = await generateCoachReply({
      coachName: COACH.name,
      profileContext: await buildProfileContext(userId),
      history,
    });
    created.push(await repo.insertMessage({ userId, role: 'mentor', kind: 'text', body: reply.reply }));
    if (reply.suggestSession) {
      const invite = await maybeInvite(userId, reply.sessionQuery);
      if (invite) created.push(invite);
    }
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    // The AI is down (even after retries). Flag this student turn (issue = 1) and reply
    // with a human-sounding "I'll get back to you" note so the student always gets an
    // acknowledgement instead of silence.
    logger.error({ err }, 'career-chat coach reply failed');
    await repo.markIssue(studentRow.id);
    created.push(await busyReply(userId));
  }

  return buildViews(userId, created);
}

/**
 * Post a "busy mentor" fallback for a failed turn, so the student always gets a reply
 * instead of silence. Avoids repeating the exact line the coach used last time, so two
 * back-to-back failures don't echo the identical note. Returns the row it posted.
 */
async function busyReply(userId: string): Promise<repo.CareerChatRow> {
  const rows = await repo.listByUser(userId);
  const lastBody = rows[rows.length - 1]?.body ?? '';
  const fresh = BUSY_REPLIES.filter((b) => b !== lastBody);
  const pool = fresh.length ? fresh : BUSY_REPLIES;
  const body = pool[Math.floor(Math.random() * pool.length)]!;
  return repo.insertMessage({ userId, role: 'mentor', kind: 'text', body });
}

/**
 * Proactive idle nudge: when the student has read the coach's reply but gone quiet, the
 * coach sends ONE short follow-up question — like a real mentor prodding gently. Fires at
 * most once per idle gap (guarded by `isNudgeEligible`) and is best-effort: an AI hiccup
 * just leaves the thread as-is. Returns only the new nudge message (the client appends
 * it), or an empty array when nothing was posted.
 */
export async function nudge(userId: string): Promise<CareerChatMessageView[]> {
  const rows = await repo.listByUser(userId);
  if (!isNudgeEligible(rows)) return [];

  const history = await buildHistory(userId, rows.slice(-HISTORY_WINDOW));
  const lastCoach = rows[rows.length - 1]!.body;
  try {
    const reply = await generateCoachReply({
      coachName: COACH.name,
      profileContext: await buildProfileContext(userId),
      history,
      nudge: true,
    });
    // Belt-and-braces: if the model still echoed its last line, drop the nudge rather
    // than post a duplicate. A missed nudge is better than a repeat.
    if (norm(reply.reply) === norm(lastCoach)) return [];
    const coachRow = await repo.insertMessage({ userId, role: 'mentor', kind: 'nudge', body: reply.reply });
    return buildViews(userId, [coachRow]);
  } catch (err) {
    if (err instanceof AiError) {
      logger.error({ err }, 'career-chat nudge failed');
      return [];
    }
    throw err;
  }
}

/** A conversation gets at most this many proactive idle nudges over its whole lifetime. */
const MAX_NUDGES = 3;

/**
 * Nudge only when: the student has engaged at least once, the coach's last message was a
 * real reply (`text`, not a nudge/card), we haven't already nudged this gap (fewer than
 * two trailing coach messages), AND the conversation hasn't used up its nudge budget —
 * so a student who keeps going quiet gets a couple of gentle prods, not an endless stream.
 */
function isNudgeEligible(rows: repo.CareerChatRow[]): boolean {
  if (rows.filter((r) => r.kind === 'nudge').length >= MAX_NUDGES) return false;
  const last = rows[rows.length - 1];
  if (!last || last.role !== 'mentor' || last.kind !== 'text') return false;
  if (!rows.some((r) => r.role === 'student')) return false;
  let trailing = 0;
  for (let i = rows.length - 1; i >= 0 && rows[i]!.role === 'mentor'; i -= 1) trailing += 1;
  return trailing < 2;
}

/** Enroll from a session-invite card: auto-like + "Enrolled!" comment, then confirm in-chat. */
export async function enroll(
  userId: string,
  input: EnrollCareerChatInput,
): Promise<CareerChatMessageView[]> {
  const invite = await repo.findInvite(userId, input.sessionId);
  if (!invite) throw new CareerChatError('INVITE_NOT_FOUND', 'No matching session invite', 404);

  const session = await liveRepo.findById(input.sessionId);
  if (!session) throw new CareerChatError('SESSION_NOT_FOUND', 'That session is no longer available', 404);

  // Reuse the live-session reactions: an idempotent like + a comment as the student.
  await liveRepo.insertLike(input.sessionId, userId);
  const studentName = (await repo.findUserName(userId)) ?? 'A student';
  await liveRepo.insertMessage({
    sessionId: input.sessionId,
    authorUserId: userId,
    authorName: studentName,
    body: ENROLL_COMMENT,
  });

  await repo.markEnrolled(invite.id);
  const confirmation = await repo.insertMessage({
    userId,
    role: 'mentor',
    kind: 'text',
    body: "Awesome — you're in! 🎉 I saved your spot and left a note for the host. See you there.",
  });

  // Delta = the (now-enrolled) invite card + the confirmation. The client merges by id,
  // so the existing card flips to "enrolled" in place and the confirmation appends.
  const updatedInvite = await repo.findById(invite.id);
  const delta = updatedInvite ? [updatedInvite, confirmation] : [confirmation];
  return buildViews(userId, delta);
}

// --- Internals ---

async function ensureSeeded(userId: string): Promise<void> {
  if ((await repo.countByUser(userId)) > 0) return;
  const name = firstName(await repo.findUserName(userId));
  const greeting =
    `Hey${name ? ` ${name}` : ''}, I'm ${COACH.name} 👋 Good to meet you. ` +
    "Before I throw any advice at you, tell me a bit about where you're at right now — " +
    "job hunt, interviews, deciding what to learn? What's on your mind?";
  await repo.insertMessage({ userId, role: 'mentor', kind: 'text', body: greeting });
}

async function buildProfileContext(userId: string): Promise<string> {
  try {
    const p = await getProfile(userId);
    const name = await repo.findUserName(userId);
    const parts: string[] = [];
    if (name) parts.push(`Name: ${name}`);
    if (p.currentRole) parts.push(`Current role: ${p.currentRole}`);
    if (p.experienceLevel) parts.push(`Experience level: ${p.experienceLevel}`);
    if (p.targetRoles?.length) parts.push(`Target roles: ${p.targetRoles.join(', ')}`);
    if (p.techStack?.length) parts.push(`Skills: ${p.techStack.join(', ')}`);
    if (p.goal) parts.push(`Goal: ${p.goal}`);
    return parts.length ? parts.join('\n') : 'No profile details on file yet.';
  } catch {
    return 'No profile details on file yet.';
  }
}

/**
 * Attach a live-session invite when the coach asked for one. Picks the upcoming session
 * that best matches the coach's topic hint (else the soonest), and skips it if the
 * student already has a pending invite or has already enrolled — so we never stack cards.
 * Returns the invite row it posted (for the turn's delta), or null when it skips.
 */
async function maybeInvite(userId: string, query: string | null): Promise<repo.CareerChatRow | null> {
  if ((await repo.pendingInviteCount(userId)) > 0) return null;

  const upcoming = await liveRepo.listUpcoming();
  if (upcoming.length === 0) return null;

  const q = (query ?? '').trim().toLowerCase();
  const match = q
    ? upcoming.find((s) => `${s.title} ${s.topic}`.toLowerCase().includes(q))
    : null;
  const chosen = match ?? upcoming[0]!;

  if (await liveRepo.hasLiked(userId, chosen.id)) return null; // already enrolled

  return repo.insertMessage({
    userId,
    role: 'mentor',
    kind: 'session-invite',
    body: INVITE_LINE,
    sessionId: chosen.id,
  });
}

/**
 * Turn stored rows into the AI history. Crucially, `session-invite` turns are rewritten
 * into a descriptive line naming the exact session the coach shared and how the student
 * joins (the Enroll button — there is no link) so the coach can actually reason about it
 * later: e.g. answer "resend the link" correctly instead of being clueless about it.
 */
async function buildHistory(userId: string, rows: repo.CareerChatRow[]): Promise<HistoryTurn[]> {
  const inviteIds = [...new Set(rows.filter((r) => r.kind === 'session-invite' && r.sessionId).map((r) => r.sessionId!))];
  const cards = await buildSessionCards(userId, inviteIds);

  return rows.map((r) => {
    if (r.kind === 'session-invite' && r.sessionId) {
      const c = cards.get(r.sessionId);
      const when = c?.scheduledFor ? `, scheduled for ${c.scheduledFor}` : '';
      const body = c
        ? `(You shared a live session invite card here: "${c.title}" — hosted by ${c.mentorName}${when}. ` +
          'The student joins by tapping the "Enroll" button on that card. There is NO link or URL to ' +
          `send — enrolling happens through that button.${c.enrolled ? ' The student has already enrolled.' : ''})`
        : '(You shared a live session invite card here. The student joins via the Enroll button on it — there is no link to send.)';
      return { role: r.role, body };
    }
    return { role: r.role, body: r.body };
  });
}

/** Resolve the session cards for every invite in one batch, then map rows → views. */
async function buildViews(userId: string, rows: repo.CareerChatRow[]): Promise<CareerChatMessageView[]> {
  const inviteIds = [...new Set(rows.filter((r) => r.sessionId).map((r) => r.sessionId!))];
  const cards = await buildSessionCards(userId, inviteIds);
  const studentName = (await repo.findUserName(userId)) ?? 'You';

  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    kind: r.kind,
    body: r.body,
    authorName: r.role === 'mentor' ? COACH.name : studentName,
    authorAvatarUrl: null,
    createdAt: new Date(r.createdAt).toISOString(),
    session: r.sessionId ? cards.get(r.sessionId) ?? null : null,
  }));
}

async function buildSessionCards(
  userId: string,
  sessionIds: string[],
): Promise<Map<string, CareerChatSessionCard>> {
  const out = new Map<string, CareerChatSessionCard>();
  if (sessionIds.length === 0) return out;

  const sessions = (await Promise.all(sessionIds.map((id) => liveRepo.findById(id)))).filter(
    (s): s is NonNullable<typeof s> => Boolean(s),
  );
  const liveIds = sessions.map((s) => s.id);
  const [mentorCards, likeCounts, chatCounts, liked] = await Promise.all([
    liveRepo.findUserCards([...new Set(sessions.map((s) => s.mentorId))]),
    liveRepo.countLikesForSessions(liveIds),
    liveRepo.countMessagesForSessions(liveIds),
    liveRepo.likedSessionIds(userId, liveIds),
  ]);

  for (const s of sessions) {
    const mentor = mentorCards.get(s.mentorId) ?? { name: 'Mentor', avatarUrl: null };
    out.set(s.id, {
      id: s.id,
      title: s.title,
      topic: s.topic,
      mentorName: mentor.name,
      mentorAvatarUrl: mentor.avatarUrl,
      scheduledFor: iso(s.scheduledFor),
      likeCount: likeCounts.get(s.id) ?? 0,
      chatCount: chatCounts.get(s.id) ?? 0,
      enrolled: liked.has(s.id),
    });
  }
  return out;
}
