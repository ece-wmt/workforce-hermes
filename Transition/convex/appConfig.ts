import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Workspace configuration — a single shared row for the whole team (same
 * singleton pattern as the handbook). Stores org-level defaults:
 *
 *   • defaultMilestones    — the milestone template pre-filled when creating
 *                            a new project (name + days rows)
 *   • productionDeadline   — ms timestamp for when Workforce Hermes ships to
 *                            full production (shown on the Dashboard)
 *
 * Edit permission is enforced on the client (Admin+ only), matching the
 * trust model used by the rest of this app's mutations.
 */

export const getAppConfig = query({
  handler: async (ctx) => {
    const docs = await ctx.db.query("appConfig").collect();
    return docs[0] || null;
  },
});

export const saveAppConfig = mutation({
  args: {
    // null clears the deadline; undefined leaves it untouched
    productionDeadline: v.optional(v.union(v.number(), v.null())),
    defaultMilestones: v.optional(
      v.array(v.object({ name: v.string(), days: v.number() }))
    ),
    updatedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = (await ctx.db.query("appConfig").collect())[0];

    const patch: Record<string, unknown> = {
      updatedAt: Date.now(),
      updatedBy: args.updatedBy || "",
    };
    if (args.productionDeadline !== undefined) {
      // patching with undefined removes the field (clears the deadline)
      patch.productionDeadline =
        args.productionDeadline === null ? undefined : args.productionDeadline;
    }
    if (args.defaultMilestones !== undefined) {
      patch.defaultMilestones = args.defaultMilestones;
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("appConfig", patch as any);
  },
});
