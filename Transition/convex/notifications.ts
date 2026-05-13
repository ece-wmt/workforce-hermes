import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get all notifications for a user, latest first.
 * Caps at 50 to save bandwidth.
 */
export const getNotifications = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const lowerEmail = args.email.toLowerCase();
    const all = await ctx.db
      .query("notifications")
      .withIndex("by_target", (q) => q.eq("targetEmail", lowerEmail))
      .collect();

    // Sort latest first and cap at 50
    return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
  },
});

/**
 * Get count of unread notifications for badge display.
 */
export const getUnreadCount = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const lowerEmail = args.email.toLowerCase();
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_target_read", (q) =>
        q.eq("targetEmail", lowerEmail).eq("read", false)
      )
      .collect();
    return unread.length;
  },
});

/**
 * Mark a single notification as read.
 */
export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.notificationId, { read: true });
  },
});

/**
 * Mark all notifications for a user as read.
 */
export const markAllRead = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const lowerEmail = args.email.toLowerCase();
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_target_read", (q) =>
        q.eq("targetEmail", lowerEmail).eq("read", false)
      )
      .collect();

    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
  },
});

/**
 * Create a notification. Called by other mutations.
 */
export const createNotification = mutation({
  args: {
    type: v.string(),
    targetEmail: v.string(),
    actorEmail: v.string(),
    actorName: v.string(),
    message: v.string(),
    taskId: v.optional(v.id("tasks")),
    taskTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Don't notify yourself
    if (args.targetEmail.toLowerCase() === args.actorEmail.toLowerCase()) return;

    await ctx.db.insert("notifications", {
      type: args.type,
      targetEmail: args.targetEmail.toLowerCase(),
      actorEmail: args.actorEmail.toLowerCase(),
      actorName: args.actorName,
      message: args.message,
      taskId: args.taskId,
      taskTitle: args.taskTitle,
      read: false,
      createdAt: Date.now(),
    });
  },
});
/**
 * Get the single latest notification for a user.
 */
export const getLatestNotification = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const lowerEmail = args.email.toLowerCase();
    const latest = await ctx.db
      .query("notifications")
      .withIndex("by_target", (q) => q.eq("targetEmail", lowerEmail))
      .order("desc")
      .first();
    return latest;
  },
});
