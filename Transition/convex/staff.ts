import { query, mutation, internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
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
    }
  },
});

export const generateResetPin = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const lowerEmail = args.email.toLowerCase();
    let existing = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", lowerEmail))
      .first();

    if (!existing) {
      // Check if they are in INITIAL_STAFF
      const initial = INITIAL_STAFF.find(s => s.email.toLowerCase() === lowerEmail);
      if (initial) {
        // Insert them into the DB so we can assign a reset PIN
        const newId = await ctx.db.insert("staff", {
          name: initial.name,
          email: lowerEmail,
          role: initial.role,
        });
        existing = await ctx.db.get(newId);
      } else {
        throw new Error("Account not found.");
      }
    }

    if (existing?.role === "Revoked") {
      throw new Error("Account access revoked.");
    }

    // Generate a 6-digit random code
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes

    await ctx.db.patch(existing!._id, {
      resetCode: pin,
      resetCodeExpiry: expiry,
    });

    return { pin, email: existing!.email, name: existing!.name };
  },
});

export const requestPasswordReset = action({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const { pin, email, name } = await ctx.runMutation(internal.staff.generateResetPin, { email: args.email });

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY environment variable.");
      throw new Error("Email service is not configured. Please contact the administrator.");
    }

    const { Resend } = await import("resend");
    const resend = new Resend(resendApiKey);

    const { error } = await resend.emails.send({
      from: "Workforce Hermes <onboarding@resend.dev>",
      to: email,
      subject: "Your Password Reset PIN",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #1e293b;">Password Reset Request</h2>
          <p style="color: #475569;">Hello ${name},</p>
          <p style="color: #475569;">We received a request to reset your password for Workforce Hermes. Here is your 6-digit verification PIN:</p>
          <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #10b981; border-radius: 8px; margin: 20px 0;">
            ${pin}
          </div>
          <p style="color: #475569;">This PIN will expire in 15 minutes.</p>
          <p style="color: #475569; font-size: 12px; margin-top: 30px;">If you did not request this reset, please ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      throw new Error("Failed to send reset email. " + error.message);
    }

    return { success: true, message: "Reset PIN sent to your email." };
  },
});

export const verifyResetPin = mutation({
  args: {
    email: v.string(),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const lowerEmail = args.email.toLowerCase();
    const existing = await ctx.db
      .query("staff")
      .withIndex("by_email", (q) => q.eq("email", lowerEmail))
      .first();

    if (!existing) throw new Error("Account not found.");

    if (!existing.resetCode || existing.resetCode !== args.pin) {
      throw new Error("Invalid or incorrect PIN.");
    }

    if (existing.resetCodeExpiry && Date.now() > existing.resetCodeExpiry) {
      throw new Error("Reset PIN has expired. Please request a new one.");
    }

    // PIN is correct, clear the PIN and password
    await ctx.db.patch(existing._id, {
      password: undefined,
      resetCode: undefined,
      resetCodeExpiry: undefined,
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
