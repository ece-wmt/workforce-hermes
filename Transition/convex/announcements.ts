import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get all announcements, latest first.
 */
export const getAnnouncements = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("announcements").collect();
    return all.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Get the first unseen announcement for a specific user.
 * Returns null if all announcements have been seen.
 */
export const getUnseenAnnouncement = query({
  args: { userEmail: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("announcements").collect();
    // Return the oldest unseen announcement first (so user sees them in order)
    const unseen = all
      .filter((a) => !a.seenBy.includes(args.userEmail.toLowerCase()))
      .sort((a, b) => a.createdAt - b.createdAt);
    return unseen.length > 0 ? unseen[0] : null;
  },
});

/**
 * Post a new announcement (Admin+ only — enforced on frontend).
 */
export const postAnnouncement = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    postedBy: v.string(),
    postedByEmail: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("announcements", {
      title: args.title,
      body: args.body,
      postedBy: args.postedBy,
      postedByEmail: args.postedByEmail.toLowerCase(),
      createdAt: Date.now(),
      seenBy: [],
    });
  },
});

/**
 * Mark an announcement as seen by a user.
 */
export const markAnnouncementSeen = mutation({
  args: {
    announcementId: v.id("announcements"),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const announcement = await ctx.db.get(args.announcementId);
    if (!announcement) return;

    const lowerEmail = args.userEmail.toLowerCase();
    if (announcement.seenBy.includes(lowerEmail)) return;

    await ctx.db.patch(args.announcementId, {
      seenBy: [...announcement.seenBy, lowerEmail],
    });
  },
});

/**
 * Delete an announcement.
 */
export const deleteAnnouncement = mutation({
  args: { announcementId: v.id("announcements") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.announcementId);
  },
});
