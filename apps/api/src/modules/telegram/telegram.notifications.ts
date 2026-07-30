import { events } from '../../core/events.js';
import { escapeHtml, nowIST } from './telegram.client.js';
import { notify } from './telegram.service.js';

/**
 * Subscribes the Telegram notifier to the domain events an operator cares about.
 * Called once from app bootstrap — see registerTelegramNotifications() below.
 *
 * Formatting mirrors the ops-channel style used across our other product: a bold
 * headline, labelled fields, and an IST timestamp. Every interpolated value is
 * HTML-escaped because these carry user-supplied text (names, messages) and Telegram
 * would otherwise reject the message — or render the user's markup.
 */

function line(label: string, value: unknown, mono = false): string | null {
  if (value == null || value === '') return null;
  const rendered = mono ? `<code>${escapeHtml(value)}</code>` : escapeHtml(value);
  return `${label} ${rendered}`;
}

function compose(headline: string, parts: (string | null)[]): string {
  return [headline, '', ...parts.filter(Boolean), `🕐 <b>Time:</b> ${nowIST()}`].join('\n');
}

export function registerTelegramNotifications(): void {
  events.on('lead.enquiry.created', (p) => {
    return notify(
      'lead.enquiry',
      compose('📥 <b>New Landing Enquiry</b>', [
        line('👤 <b>Name:</b>', p.name),
        line('📧 <b>Email:</b>', p.email),
        line('📱 <b>Phone:</b>', p.phone, true),
        line('🎯 <b>Interest:</b>', p.interest),
        p.message ? `\n📝 <b>Message:</b>\n<i>${escapeHtml(p.message)}</i>` : null,
      ]),
    );
  });

  events.on('user.registered', (p) => {
    return notify(
      'user.signup',
      compose('🆕 <b>New Signup</b>', [
        line('👤 <b>Name:</b>', p.name),
        line('📧 <b>Email:</b>', p.email),
        line('🎭 <b>Role:</b>', p.role),
        line('🆔 <b>User ID:</b>', p.userId, true),
      ]),
    );
  });

  events.on('support.message.created', (p) => {
    return notify(
      'support.message',
      compose('💬 <b>New Support Message</b>', [
        line('👤 <b>User:</b>', p.name),
        line('📧 <b>Email:</b>', p.email),
        line('🆔 <b>User ID:</b>', p.userId, true),
        line('📍 <b>Source:</b>', p.source),
        `\n📝 <b>Message:</b>\n<i>${escapeHtml(p.message)}</i>`,
      ]),
    );
  });
}
