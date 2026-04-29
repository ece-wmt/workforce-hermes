import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    title: v.string(),
    status: v.string(),
    assignee: v.string(),
    description: v.optional(v.string()),
    milestones: v.array(
      v.object({
        name: v.string(),
        days: v.number(),
        completed: v.optional(v.boolean()),
        completedAt: v.optional(v.string()),
        createdAtTime: v.optional(v.number()),
      })
    ),
    completedMilestones: v.number(),
    notes: v.array(
      v.object({
        text: v.string(),
        date: v.string(),
        timestamp: v.optional(v.number()),
        writer: v.optional(v.string()),
        reactions: v.optional(
          v.object({
            like: v.optional(v.array(v.string())),
            wow: v.optional(v.array(v.string())),
            heart: v.optional(v.array(v.string())),
            haha: v.optional(v.array(v.string())),
          })
        ),
        replies: v.optional(
          v.array(
            v.object({
              text: v.string(),
              date: v.string(),
              timestamp: v.number(),
              writer: v.string(),
            })
          )
        ),
      })
    ),
    startDate: v.optional(v.string()),
    projectLink: v.optional(v.string()),
    adminCredentials: v.optional(v.any()),
    lastUpdated: v.number(),
    features: v.optional(
      v.array(
        v.object({
          id: v.string(),
          name: v.string(),
          description: v.string(),
          status: v.string(),
          suggestedBy: v.optional(v.string()),
          imageStorageIds: v.optional(v.array(v.string())),
          type: v.optional(v.string()),
          createdAt: v.optional(v.string()),
          createdAtTime: v.optional(v.number()),
          completedAt: v.optional(v.string()),
          completedAtTime: v.optional(v.number()),
        })
      )
    ),
  }),

  staff: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.string(),
    password: v.optional(v.string()),
    avatarUrl: v.optional(v.union(v.string(), v.null())),
    bio: v.optional(v.union(v.string(), v.null())),
    country: v.optional(v.union(v.string(), v.null())),
    status: v.optional(v.union(v.string(), v.null())),
    lastSeen: v.optional(v.number()),
  }).index("by_email", ["email"]),

  notebook: defineTable({
    name: v.string(),
    description: v.string(),
    pros: v.optional(v.string()),
    cons: v.optional(v.string()),
    details: v.optional(v.string()),
    date: v.string(),
    taker: v.optional(v.string()),
  }),

  taskViewHistory: defineTable({
    taskId: v.id("tasks"),
    userEmail: v.string(),
    lastViewedAt: v.number(),
  }).index("by_task_user", ["taskId", "userEmail"]),

  announcements: defineTable({
    title: v.string(),
    body: v.string(),
    postedBy: v.string(),
    postedByEmail: v.string(),
    createdAt: v.number(),
    seenBy: v.array(v.string()),
  }),
});
