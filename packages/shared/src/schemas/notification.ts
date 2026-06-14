/**
 * Notifications — a single inbox table that holds every kind of in-app notification
 * (community mentions/comments, mentor bookings, payments, doubts, feedback…). The
 * `type` is a free string namespace (e.g. 'community.comment', 'mentor.booking_confirmed')
 * and `title`/`body` are denormalized at creation time so the client just renders.
 */
export type NotificationView = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  /** In-app route to open when the notification is clicked, if any. */
  link: string | null;
  read: boolean;
  createdAt: string;
};
