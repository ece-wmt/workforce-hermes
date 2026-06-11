import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * The handbook is a single shared document for the whole team. We keep exactly
 * one row in the `handbook` table; `getHandbook` returns it (or null when the
 * handbook has never been saved) and `saveHandbook` upserts it.
 *
 * Edit permission is enforced on the client (Admin+ only). These functions do
 * not re-check roles server-side, matching the existing trust model used by the
 * rest of this app's mutations.
 */

export const getHandbook = query({
  handler: async (ctx) => {
    const docs = await ctx.db.query("handbook").collect();
    return docs[0] || null;
  },
});

export const saveHandbook = mutation({
  args: {
    blocks: v.array(v.any()),
    updatedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = (await ctx.db.query("handbook").collect())[0];
    const payload = {
      blocks: args.blocks,
      updatedAt: Date.now(),
      updatedBy: args.updatedBy || "",
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("handbook", payload);
  },
});
