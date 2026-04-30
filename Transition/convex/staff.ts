import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Initial staff members — always present in the system.
 * These are merged with any staff added via the admin panel.
 */
const INITIAL_STAFF = [
  { name: "Rodolfo Dayot Luga II", email: "rluga@ececontactcenters.com", role: "Programmer" },
  { name: "John Mark Bigtas Trias", email: "jtrias@ececontactcenters.com", role: "Programmer" },
  { name: "Lemuel De Leon Ching", email: "lching@ececontactcenters.com", role: "Admin" },
  { name: "Gianne Carlo Fernandez Mangampat", email: "gmangampat@ececonsultinggroup.net", role: "Programmer" },
  { name: "Regie Delvo Gajelomo", email: "rgajelomo@ececonsultinggroup.com", role: "Programmer" },
  { name: "Jomari Urfe Garces", email: "jomari.garces@ececontactcenters.com", role: "Admin" },
  { name: "Main Admin", email: "wmt@ececontactcenters.com", role: "Admin" },
];

export const getStaff = query({
  args: {},
  handler: async (ctx) => {
    const savedStaff = await ctx.db.query("staff").collect();

    // Merge: initial staff are always present, saved staff can override
    const staffMap: Record<string, any> = {};
    INITIAL_STAFF.forEach((s) => {
      staffMap[s.email.toLowerCase()] = { ...s };
    });
    savedStaff.forEach((s) => {
      staffMap[s.email.toLowerCase()] = s;
    });

    return Object.values(staffMap).filter((s: any) => s.role !== "Revoked");
  },
});

export const addStaff = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    // Don't add duplicates
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    if (existing) return;
    await ctx.db.insert("staff", {
      name: args.name,
      email: args.email.toLowerCase(),
      role: args.role,
    });
  },
});

export const getStaffByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Check DB first
    const dbUser = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    if (dbUser) return dbUser; // Return even if Revoked/Pending

    // Fall back to INITIAL_STAFF
    const initial = INITIAL_STAFF.find(
      (s) => s.email.toLowerCase() === args.email.toLowerCase()
    );
    return initial ? { ...initial, _id: null, password: undefined } : null;
  },
});

export const setPassword = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { password: args.password });
    } else {
      // User is from INITIAL_STAFF but not yet in DB — create their DB record
      const initial = INITIAL_STAFF.find(
        (s) => s.email.toLowerCase() === args.email.toLowerCase()
      );
      if (initial) {
        await ctx.db.insert("staff", {
          name: initial.name,
          email: initial.email.toLowerCase(),
          role: initial.role,
          password: args.password,
        });
      }
    }

    // Audit log
    await ctx.db.insert("securityLogs", {
      action: "PASSWORD_SET",
      userEmail: args.email.toLowerCase(),
      targetEmail: args.email.toLowerCase(),
      details: "User set a new password.",
      timestamp: Date.now(),
    });
  },
});

export const updateStaffRole = mutation({
  args: {
    staffEmail: v.string(),
    newRole: v.string(),
  },
  handler: async (ctx, args) => {
    const lowerEmail = args.staffEmail.toLowerCase();
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", lowerEmail))
      .first();

    if (existing) {
      console.log(`Updating role for ${lowerEmail} to ${args.newRole}`);
      await ctx.db.patch(existing._id, { role: args.newRole });
    } else {
      const initial = INITIAL_STAFF.find(
        (s) => s.email.toLowerCase() === lowerEmail
      );
      if (initial) {
        console.log(`Inserting initial staff ${lowerEmail} with role ${args.newRole}`);
        await ctx.db.insert("staff", {
          name: initial.name,
          email: initial.email.toLowerCase(),
          role: args.newRole,
        });
      }
    }

    // Audit log
    await ctx.db.insert("securityLogs", {
      action: "ROLE_CHANGED",
      userEmail: "admin", // Only admins can change roles in this app
      targetEmail: lowerEmail,
      details: `Role updated to: ${args.newRole}`,
      timestamp: Date.now(),
    });
  },
});

export const deleteStaff = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const lowerEmail = args.email.toLowerCase();
    console.log(`Attempting to revoke/delete staff: ${lowerEmail}`);
    
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", lowerEmail))
      .first();
    
    if (existing) {
      console.log(`Patching existing record ${existing._id} to Revoked`);
      await ctx.db.patch(existing._id, { role: "Revoked" });
    } else {
      const initial = INITIAL_STAFF.find(
        (s) => s.email.toLowerCase() === lowerEmail
      );
      if (initial) {
        console.log(`Inserting INITIAL_STAFF record as Revoked for ${lowerEmail}`);
        await ctx.db.insert("staff", {
          name: initial.name,
          email: initial.email.toLowerCase(),
          role: "Revoked",
        });
      } else {
        console.log(`No record found for ${lowerEmail} to revoke.`);
      }
    }
  },
});

export const updateProfile = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    bio: v.optional(v.union(v.string(), v.null())),
    avatarUrl: v.optional(v.union(v.string(), v.null())),
    country: v.optional(v.union(v.string(), v.null())),
    status: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const lowerEmail = args.email.toLowerCase();
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", lowerEmail))
      .first();

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.bio !== undefined) updates.bio = args.bio;
    if (args.avatarUrl !== undefined) updates.avatarUrl = args.avatarUrl;
    if (args.country !== undefined) updates.country = args.country;
    if (args.status !== undefined) updates.status = args.status;

    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      const initial = INITIAL_STAFF.find(s => s.email.toLowerCase() === lowerEmail);
      await ctx.db.insert("staff", {
        name: args.name || initial?.name || "User",
        email: lowerEmail,
        role: initial?.role || "Programmer",
        ...updates,
      });
    }
  },
});

export const resetPassword = mutation({
  args: {
    targetEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const lowerEmail = args.targetEmail.toLowerCase();
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", lowerEmail))
      .first();

    if (existing) {
      // Clear the password so the user must set a new one on next login
      await ctx.db.patch(existing._id, { password: undefined });

      // Audit log
      await ctx.db.insert("securityLogs", {
        action: "PASSWORD_RESET_BY_ADMIN",
        userEmail: "admin",
        targetEmail: lowerEmail,
        details: "Admin reset password for user.",
        timestamp: Date.now(),
      });
    }
  },
});

export const getSecurityQuestion = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const lowerEmail = args.email.toLowerCase();
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", lowerEmail))
      .first();

    if (!existing || existing.role === "Revoked") {
      throw new Error("Account not found or revoked.");
    }

    if (!existing.securityQuestion) {
      throw new Error("No security question is set for this account. Please contact an Administrator.");
    }

    return { question: existing.securityQuestion };
  },
});

export const setSecurityQuestion = mutation({
  args: {
    email: v.string(),
    question: v.string(),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const lowerEmail = args.email.toLowerCase();
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", lowerEmail))
      .first();

    if (!existing) throw new Error("Account not found.");

    await ctx.db.patch(existing._id, {
      securityQuestion: args.question,
      securityAnswer: args.answer.trim().toLowerCase(),
    });

    // Audit log
    await ctx.db.insert("securityLogs", {
      action: "SECURITY_QUESTION_SET",
      userEmail: lowerEmail,
      targetEmail: lowerEmail,
      details: `Security question updated to: "${args.question}"`,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

export const verifySecurityAnswer = mutation({
  args: {
    email: v.string(),
    answer: v.string(),
  },
  handler: async (ctx, args) => {
    const lowerEmail = args.email.toLowerCase();
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", lowerEmail))
      .first();

    if (!existing) throw new Error("Account not found.");

    if (!existing.securityAnswer) {
      throw new Error("No security question is set for this account.");
    }

    if (existing.securityAnswer !== args.answer.trim().toLowerCase()) {
      // Audit log — failed attempt
      await ctx.db.insert("securityLogs", {
        action: "SECURITY_ANSWER_FAILED",
        userEmail: lowerEmail,
        targetEmail: lowerEmail,
        details: "Incorrect answer to security question.",
        timestamp: Date.now(),
      });
      throw new Error("Incorrect answer to the security question.");
    }

    // Answer is correct, clear the password
    await ctx.db.patch(existing._id, {
      password: undefined,
    });

    // Audit log — success
    await ctx.db.insert("securityLogs", {
      action: "PASSWORD_RESET_VIA_SECURITY_QUESTION",
      userEmail: lowerEmail,
      targetEmail: lowerEmail,
      details: "Password cleared after answering security question correctly.",
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

export const heartbeat = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const lowerEmail = args.email.toLowerCase();
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", lowerEmail))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeen: Date.now() });
    } else {
      const initial = INITIAL_STAFF.find(s => s.email.toLowerCase() === lowerEmail);
      if (initial) {
        await ctx.db.insert("staff", {
          name: initial.name,
          email: lowerEmail,
          role: initial.role,
          lastSeen: Date.now(),
        });
      }
    }
  },
});
