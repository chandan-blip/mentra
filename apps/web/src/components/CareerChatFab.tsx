import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMyAccess } from '../lib/access.js';
import { useChrome } from '../lib/chrome.js';

/**
 * Floating "Chat with your Mentor" button. Sits bottom-right on every in-app page
 * (except the chat page itself), a persistent way into the career-chat coach. Only
 * rendered when the user's plan actually unlocks the `career-chat` module — admins
 * see it too. It rides above the mobile bottom-nav and hides with the app chrome on
 * scroll so it never covers content the user is reading.
 */
export function CareerChatFab() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { hidden } = useChrome();
  const { data: access } = useMyAccess();

  // Only offer it where it's usable: the module is unlocked for this user (admins
  // bypass the plan gate), and we're not already on the chat page.
  const entitled =
    access?.isAdmin || access?.modules.some((m) => m.key === 'career-chat' && m.unlocked);
  const onChatPage = pathname.startsWith('/chat-with-mentor');
  if (!entitled || onChatPage) return null;

  return (
    <div
      className={`pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-40 transition-[opacity,transform] duration-300 ease-out md:bottom-6 md:right-6 ${
        hidden ? 'translate-y-6 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <motion.button
        type="button"
        onClick={() => navigate('/chat-with-mentor')}
        aria-label="Chat with your Mentor"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.15 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.94 }}
        className="group pointer-events-auto relative flex h-14 items-center gap-0 overflow-hidden rounded-full bg-surface-inverse pl-[15px] pr-[15px] text-ink-inverse shadow-[0_8px_30px_rgba(0,0,0,0.28)] ring-1 ring-white/10 transition-[padding] duration-300 ease-out hover:pr-6"
      >
        {/* Soft aurora sheen that drifts on hover — keeps the pill from feeling flat. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-8 bg-[radial-gradient(60%_60%_at_30%_20%,rgba(255,255,255,0.18),transparent_70%)]"
          animate={{ opacity: [0.4, 0.7, 0.4], rotate: [0, 12, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />

        <span className="relative grid size-6 shrink-0 place-items-center">
          <MessageCircle className="size-[22px]" strokeWidth={2} />
          {/* Online pulse — signals the coach is "available", mirrors the chat header. */}
          <span className="absolute -right-0.5 -top-0.5 flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-green opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-accent-green ring-2 ring-surface-inverse" />
          </span>
        </span>

        {/* Label reveals on hover — collapses to a clean icon-only pill at rest. */}
        <span className="relative ml-0 max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-300 ease-out group-hover:ml-2.5 group-hover:max-w-[12rem] group-hover:opacity-100">
          Chat with your Mentor
        </span>
      </motion.button>
    </div>
  );
}
