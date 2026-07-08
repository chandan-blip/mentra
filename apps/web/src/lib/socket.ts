import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ChatMessageView, JoinTokenResponse } from '@mentra/shared';
import { apiFetch } from './api.js';
import { getAccessToken, getApiBaseUrl, refreshAccessToken } from './auth.js';

export type RaisedHand = { userId: string; name: string };

export type LiveSocket = {
  messages: ChatMessageView[];
  viewerCount: number;
  /** Students who have raised a hand (mentor side only). */
  hands: RaisedHand[];
  connected: boolean;
  sendMessage: (body: string) => void;
  raiseHand: () => void;
  approveHand: (targetUserId: string) => void;
  /** Mentor force-mutes an approved/speaking student's mic (owner-only, server-enforced). */
  muteParticipant: (targetUserId: string) => void;
  /** Register a callback for when a mentor promotes you to publish. */
  onPromoted: (cb: (grant: JoinTokenResponse) => void) => void;
};

/**
 * Connects to the live-session Socket.IO namespace for one session: loads chat
 * history, streams new messages, tracks the (webhook-driven) viewer count, and
 * carries raise-hand / promotion signalling. Pass `null` to stay disconnected.
 */
export function useLiveSocket(sessionId: string | null): LiveSocket {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [hands, setHands] = useState<RaisedHand[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const promotedCb = useRef<((grant: JoinTokenResponse) => void) | null>(null);

  useEffect(() => {
    if (!sessionId) return undefined;
    let disposed = false;

    apiFetch<ChatMessageView[]>(`/api/v1/live-session/sessions/${sessionId}/messages`)
      .then((history) => {
        if (!disposed) setMessages(history);
      })
      .catch(() => {});

    const socket = io(getApiBaseUrl(), {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token: getAccessToken() },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('live:join', { sessionId });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('chat:new', (m: ChatMessageView) => setMessages((prev) => [...prev, m]));
    socket.on('presence:update', ({ count }: { count: number }) => setViewerCount(count));
    socket.on('hand:raised', (h: RaisedHand) =>
      setHands((prev) => (prev.some((x) => x.userId === h.userId) ? prev : [...prev, h])),
    );
    socket.on('live:promoted', (grant: JoinTokenResponse) => promotedCb.current?.(grant));

    // If the access token expired, refresh once and reconnect with the new one.
    socket.on('connect_error', async (err: Error) => {
      if (err.message === 'AUTH_INVALID' || err.message === 'AUTH_REQUIRED') {
        const refreshed = await refreshAccessToken();
        if (refreshed && !disposed) {
          socket.auth = { token: refreshed };
          socket.connect();
        }
      }
    });

    return () => {
      disposed = true;
      socket.emit('live:leave', { sessionId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  const sendMessage = useCallback(
    (body: string) => {
      if (body.trim()) socketRef.current?.emit('chat:send', { sessionId, body: body.trim() });
    },
    [sessionId],
  );

  const raiseHand = useCallback(() => {
    socketRef.current?.emit('hand:raise', { sessionId });
  }, [sessionId]);

  const approveHand = useCallback(
    (targetUserId: string) => {
      socketRef.current?.emit('hand:approve', { sessionId, targetUserId });
      setHands((prev) => prev.filter((h) => h.userId !== targetUserId));
    },
    [sessionId],
  );

  const muteParticipant = useCallback(
    (targetUserId: string) => {
      socketRef.current?.emit('participant:mute', { sessionId, targetUserId });
    },
    [sessionId],
  );

  const onPromoted = useCallback((cb: (grant: JoinTokenResponse) => void) => {
    promotedCb.current = cb;
  }, []);

  return {
    messages,
    viewerCount,
    hands,
    connected,
    sendMessage,
    raiseHand,
    approveHand,
    muteParticipant,
    onPromoted,
  };
}
