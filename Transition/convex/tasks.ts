import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// --- QUERIES ---

export const getTasks = query({
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

/**
 * Lightweight version of getTasks that excludes heavy nested fields.
 * Dramatically reduces bandwidth for the Kanban and List views.
 */
export const getTasksLight = query({
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    return tasks.map(({ notes, features, adminCredentials, ...light }) => {
      const notesList = notes || [];
      const featuresList = features || [];

      return {
        ...light,
        notesCount: notesList.length,
        featuresCount: featuresList.length,
        completedMilestones: light.completedMilestones || 0,
        // Most recent timestamps for badge calculations without full data
        lastNoteTimestamp: notesList.reduce((max, n) => Math.max(max, n.timestamp || 0), 0),
        lastFeatureTimestamp: featuresList.reduce((max, f) => Math.max(max, f.createdAtTime || 0), 0),
      };
    });
  },
});

// --- Obfuscation Helpers ---
// These are used to hide plain text from casual observation in the Convex DB browser.
// They are reversible so that the user can still reveal them in the modal.
function obfuscate(str: string | undefined) {
  if (!str) return str;
  try {
    const encoded = btoa(str);
    return "obf_" + encoded.split('').reverse().join('');
  } catch (e) {
    return str;
  }
}

function deobfuscate(str: string | undefined) {
  if (!str || !str.startsWith("obf_")) return str;
  try {
    const reversed = str.substring(4);
    const encoded = reversed.split('').reverse().join('');
    return atob(encoded);
  } catch (e) {
    return str;
  }
}

/**
 * Targeted query for fetching full details of a single task.
 * Used for the TaskModal to avoid fetching all tasks' notes/features.
 */
export const getTaskById = query({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return null;
    
    // Deobfuscate sensitive fields before sending to client
    if (task.adminCredentials) {
      return {
        ...task,
        adminCredentials: {
          email: deobfuscate(task.adminCredentials.email),
          password: deobfuscate(task.adminCredentials.password),
        }
      };
    }
    
    return task;
  },
});

export const getProjectStats = query({
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();

    interface WorkloadInfo {
      name: string;
      active: number;
      pending: number;
    }

    const stats: Record<string, any> = {
      todo: 0,
      pending: 0,
      development: 0,
      testing: 0,
      done: 0,
      scrapyard: 0,
      overallCompletion: 0,
      staffWorkload: [] as WorkloadInfo[],
    };

    if (tasks.length === 0) return stats;

    let totalProg = 0;
    const workloadMap: Record<string, WorkloadInfo> = {};

    tasks.forEach((t) => {
      const status = (t.status || "").toLowerCase();
      if (status in stats && typeof stats[status] === "number") {
        stats[status]++;
      } else if (status === "inprogress") {
        stats.development++;
      }

      const milestones = t.milestones || [];
      const totalM = milestones.length > 0 ? milestones.length : 10;
      const prog = totalM > 0 ? (t.completedMilestones || 0) / totalM : 0;
      totalProg += prog;

      const isActive = status === "development" || status === "inprogress";
      const isPending = status === "pending";
      if (isActive || isPending) {
        const assignees = (t.assignee || "")
          .split(",")
          .map((n) => n.trim())
          .filter((n) => n);
        assignees.forEach((name) => {
          if (!workloadMap[name])
            workloadMap[name] = { name, active: 0, pending: 0 };
          if (isActive) workloadMap[name].active++;
          if (isPending) workloadMap[name].pending++;
        });
      }
    });

    stats.overallCompletion = Math.round((totalProg / tasks.length) * 100);
    stats.staffWorkload = (Object.values(workloadMap) as WorkloadInfo[]).sort(
      (a, b) => b.active + b.pending - (a.active + a.pending)
    );

    stats.projectsWithLinks = tasks
      .filter(t => t.appscriptLink || t.webappLink || t.projectLink)
      .map(t => ({
        id: t._id,
        title: t.title,
        description: t.description,
        appscriptLink: t.appscriptLink,
        webappLink: t.webappLink || t.projectLink
      }));

    return stats;
  },
});

// --- MUTATIONS ---

export const addTask = mutation({
  args: {
    title: v.string(),
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
    startDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", {
      title: args.title,
      status: "todo",
      assignee: args.assignee,
      description: args.description || "",
      milestones: args.milestones.map((m) => ({ ...m, createdAtTime: Date.now() })),
      completedMilestones: 0,
      notes: [],
      startDate: args.startDate,
      lastUpdated: Date.now(),
    });
  },
});

export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    newStatus: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.taskId, {
      status: args.newStatus,
      lastUpdated: Date.now(),
    });
  },
});

export const updateTaskMilestones = mutation({
  args: {
    taskId: v.id("tasks"),
    milestones: v.array(
      v.object({
        name: v.string(),
        days: v.number(),
        completed: v.optional(v.boolean()),
        completedAt: v.optional(v.string()),
        createdAtTime: v.optional(v.number()),
      })
    ),
    completedCount: v.number(),
    actorEmail: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    // Check if a milestone was completed in this update
    const prevMilestones = task.milestones || [];
    const newCompletedMilestone = args.milestones.find((m, i) => 
      m.completed && (!prevMilestones[i] || !prevMilestones[i].completed)
    );

    await ctx.db.patch(args.taskId, {
      milestones: args.milestones,
      completedMilestones: args.completedCount,
      lastUpdated: Date.now(),
    });

    // --- Notification: notify task assignees about milestone completion ---
    if (newCompletedMilestone && args.actorEmail) {
      const actorEmail = args.actorEmail.toLowerCase();
      const allStaff = await ctx.db.query("staff").collect();
      const assigneeNames = (task.assignee || "").split(",").map(n => n.trim().toLowerCase()).filter(Boolean);
      
      for (const staff of allStaff) {
        if (staff.email.toLowerCase() === actorEmail) continue;
        const nameMatch = assigneeNames.some(a => staff.name.toLowerCase().includes(a) || a.includes(staff.name.toLowerCase()));
        if (nameMatch) {
          await ctx.db.insert("notifications", {
            type: "project_change",
            targetEmail: staff.email.toLowerCase(),
            actorEmail,
            actorName: args.actorName || actorEmail,
            message: `completed milestone "${newCompletedMilestone.name}" on "${task.title}"`,
            taskId: args.taskId,
            taskTitle: task.title,
            read: false,
            createdAt: Date.now(),
          });
        }
      }
    }
  },
});

export const addNoteToTask = mutation({
  args: {
    taskId: v.id("tasks"),
    noteText: v.string(),
    writer: v.string(),
    writerEmail: v.optional(v.string()),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const notes = [...(task.notes || [])];
    notes.push({
      text: args.noteText,
      date: args.date,
      timestamp: Date.now(),
      writer: args.writer,
    });

    await ctx.db.patch(args.taskId, {
      notes,
      lastUpdated: Date.now(),
    });

    // --- Notifications ---
    const actorEmail = (args.writerEmail || "").toLowerCase();
    const allStaff = await ctx.db.query("staff").collect();

    // Notify task assignees (project change) — skip the note author
    const assigneeNames = (task.assignee || "").split(",").map(n => n.trim().toLowerCase()).filter(Boolean);
    for (const staff of allStaff) {
      if (staff.email.toLowerCase() === actorEmail) continue;
      const nameMatch = assigneeNames.some(a => staff.name.toLowerCase().includes(a) || a.includes(staff.name.toLowerCase()));
      if (nameMatch) {
        await ctx.db.insert("notifications", {
          type: "project_change",
          targetEmail: staff.email.toLowerCase(),
          actorEmail,
          actorName: args.writer,
          message: `added a note on "${task.title}"`,
          taskId: args.taskId,
          taskTitle: task.title,
          read: false,
          createdAt: Date.now(),
        });
      }
    }

    // Parse @mentions from note text
    const mentions = args.noteText.match(/@([\w\s]+?)(?=[@,.]|$)/g);
    if (mentions) {
      for (const mention of mentions) {
        const mentionedName = mention.substring(1).trim().toLowerCase();
        for (const staff of allStaff) {
          if (staff.email.toLowerCase() === actorEmail) continue;
          if (staff.name.toLowerCase().includes(mentionedName) || mentionedName.includes(staff.name.toLowerCase().split(" ")[0])) {
            await ctx.db.insert("notifications", {
              type: "mention",
              targetEmail: staff.email.toLowerCase(),
              actorEmail,
              actorName: args.writer,
              message: `mentioned you in a note on "${task.title}"`,
              taskId: args.taskId,
              taskTitle: task.title,
              read: false,
              createdAt: Date.now(),
            });
          }
        }
      }
    }

    return notes;
  },
});

export const deleteTask = mutation({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.taskId);
  },
});

export const updateTaskDetails = mutation({
  args: {
    taskId: v.id("tasks"),
    newTitle: v.string(),
    newDescription: v.optional(v.string()),
    newAssignee: v.string(),
    newAppscriptLink: v.optional(v.string()),
    newWebappLink: v.optional(v.string()),
    newMilestones: v.array(
      v.object({
        name: v.string(),
        days: v.number(),
        completed: v.optional(v.boolean()),
        completedAt: v.optional(v.string()),
        createdAtTime: v.optional(v.number()),
      })
    ),
    actorEmail: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const completedCount = args.newMilestones.filter(
      (m) => m.completed
    ).length;

    await ctx.db.patch(args.taskId, {
      title: args.newTitle,
      description: args.newDescription || "",
      assignee: args.newAssignee,
      appscriptLink: args.newAppscriptLink,
      webappLink: args.newWebappLink,
      milestones: args.newMilestones.map(m => ({ ...m, createdAtTime: m.createdAtTime || Date.now() })),
      completedMilestones: completedCount,
      lastUpdated: Date.now(),
    });

    // --- Notification: notify task assignees about detail changes ---
    if (args.actorEmail) {
      const actorEmail = args.actorEmail.toLowerCase();
      const allStaff = await ctx.db.query("staff").collect();
      
      // We notify BOTH the old assignees and the new assignees (union)
      const oldAssignees = (task.assignee || "").split(",").map(n => n.trim().toLowerCase()).filter(Boolean);
      const newAssignees = (args.newAssignee || "").split(",").map(n => n.trim().toLowerCase()).filter(Boolean);
      const notifySet = new Set([...oldAssignees, ...newAssignees]);

      for (const staff of allStaff) {
        if (staff.email.toLowerCase() === actorEmail) continue;
        const nameMatch = Array.from(notifySet).some(a => staff.name.toLowerCase().includes(a) || a.includes(staff.name.toLowerCase()));
        if (nameMatch) {
          await ctx.db.insert("notifications", {
            type: "project_change",
            targetEmail: staff.email.toLowerCase(),
            actorEmail,
            actorName: args.actorName || actorEmail,
            message: `updated project details for "${args.newTitle}"`,
            taskId: args.taskId,
            taskTitle: args.newTitle,
            read: false,
            createdAt: Date.now(),
          });
        }
      }
    }
  },
});

export const updateProjectLink = mutation({
  args: {
    taskId: v.id("tasks"),
    projectLink: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(args.taskId, {
      projectLink: args.projectLink,
      lastUpdated: Date.now(),
    });
  },
});

export const updateAdminCredentials = mutation({
  args: {
    taskId: v.id("tasks"),
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    await ctx.db.patch(args.taskId, {
      adminCredentials: {
        email: obfuscate(args.email),
        password: obfuscate(args.password),
      },
      lastUpdated: Date.now(),
    });
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});

export const getFeatureImageUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    const urls = [];
    for (const id of args.storageIds) {
      urls.push(await ctx.storage.getUrl(id));
    }
    return urls;
  },
});

export const addTaskFeature = mutation({
  args: {
    taskId: v.id("tasks"),
    feature: v.object({
      id: v.string(),
      name: v.string(),
      description: v.string(),
      status: v.string(),
      suggestedBy: v.optional(v.string()),
      imageStorageIds: v.optional(v.array(v.string())),
      type: v.optional(v.string()),
      createdAt: v.optional(v.string()),
    }),
    actorEmail: v.optional(v.string()),
    actorName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log("Adding feature to task:", args.taskId, args.feature);
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const features = [...(task.features || [])];
    const featureWithTimestamp = {
      ...args.feature,
      createdAt: args.feature.createdAt || new Date().toLocaleString("en-US", {
        timeZone: "America/New_York",
        year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
      }),
      createdAtTime: Date.now(),
    };
    features.push(featureWithTimestamp);
    await ctx.db.patch(args.taskId, { features, lastUpdated: Date.now() });

    // --- Notification: notify task assignees ---
    if (args.actorEmail) {
      const actorEmail = args.actorEmail.toLowerCase();
      const allStaff = await ctx.db.query("staff").collect();
      const assigneeNames = (task.assignee || "").split(",").map(n => n.trim().toLowerCase()).filter(Boolean);
      for (const staff of allStaff) {
        if (staff.email.toLowerCase() === actorEmail) continue;
        const nameMatch = assigneeNames.some(a => staff.name.toLowerCase().includes(a) || a.includes(staff.name.toLowerCase()));
        if (nameMatch) {
          await ctx.db.insert("notifications", {
            type: "project_change",
            targetEmail: staff.email.toLowerCase(),
            actorEmail,
            actorName: args.actorName || actorEmail,
            message: `added ${args.feature.type === "bug" ? "a bug" : "a feature"} "${args.feature.name}" to "${task.title}"`,
            taskId: args.taskId,
            taskTitle: task.title,
            read: false,
            createdAt: Date.now(),
          });
        }
      }
    }
  },
});

export const updateFeatureStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    featureId: v.string(),
    status: v.string(),
    writer: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const features = [...(task.features || [])];
    const featIndex = features.findIndex(f => f.id === args.featureId);
    if (featIndex === -1) return;
    
    if (features[featIndex].status === args.status) return;

    features[featIndex].status = args.status;
    const updates: any = { features, lastUpdated: Date.now() };

    if (args.status === "completed") {
      features[featIndex].completedAt = new Date().toLocaleString("en-US", {
        timeZone: "America/New_York",
        year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
      });
      features[featIndex].completedAtTime = Date.now();
    } else {
      delete features[featIndex].completedAt;
      delete features[featIndex].completedAtTime;
    }
    
    await ctx.db.patch(args.taskId, updates);
  },
});

export const updateTaskFeature = mutation({
  args: {
    taskId: v.id("tasks"),
    featureId: v.string(),
    updates: v.object({
      name: v.string(),
      description: v.string(),
      imageStorageIds: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const features = [...(task.features || [])];
    const featIndex = features.findIndex(f => f.id === args.featureId);
    if (featIndex === -1) return;

    features[featIndex] = {
      ...features[featIndex],
      ...args.updates,
    };

    await ctx.db.patch(args.taskId, { features, lastUpdated: Date.now() });
  },
});

export const deleteTaskFeature = mutation({
  args: {
    taskId: v.id("tasks"),
    featureId: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const features = (task.features || []).filter(f => f.id !== args.featureId);
    await ctx.db.patch(args.taskId, { features, lastUpdated: Date.now() });
  },
});

export const markTaskAsViewed = mutation({
  args: {
    taskId: v.id("tasks"),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("taskViewHistory")
      .withIndex("by_task_user", (q) => q.eq("taskId", args.taskId).eq("userEmail", args.userEmail))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { lastViewedAt: Date.now() });
    } else {
      await ctx.db.insert("taskViewHistory", {
        taskId: args.taskId,
        userEmail: args.userEmail,
        lastViewedAt: Date.now(),
      });
    }
  },
});

export const getTaskViewHistory = query({
  args: {
    taskId: v.id("tasks"),
    userEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("taskViewHistory")
      .withIndex("by_task_user", (q) => q.eq("taskId", args.taskId).eq("userEmail", args.userEmail))
      .first();

    return record ? record.lastViewedAt : 0;
  },
});

export const toggleNoteReaction = mutation({
  args: {
    taskId: v.id("tasks"),
    noteIndex: v.number(),
    reactionType: v.string(), // "like" | "wow" | "heart" | "haha"
    userEmail: v.string(),
    userName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const notes = [...(task.notes || [])];
    if (args.noteIndex < 0 || args.noteIndex >= notes.length) return;

    const note = { ...notes[args.noteIndex] };
    const reactions = note.reactions
      ? { ...note.reactions }
      : { like: [], wow: [], heart: [], haha: [] };

    const key = args.reactionType as "like" | "wow" | "heart" | "haha";
    const arr = [...(reactions[key] || [])];
    const lowerEmail = args.userEmail.toLowerCase();
    const idx = arr.indexOf(lowerEmail);

    let isAdding = false;
    if (idx >= 0) {
      arr.splice(idx, 1); // remove reaction
    } else {
      arr.push(lowerEmail); // add reaction
      isAdding = true;
    }

    reactions[key] = arr;
    note.reactions = reactions;
    notes[args.noteIndex] = note;

    await ctx.db.patch(args.taskId, { notes });

    // --- Notification: notify the note author about the reaction ---
    if (isAdding && note.writer) {
      const allStaff = await ctx.db.query("staff").collect();
      const emojiMap: Record<string, string> = { like: "👍", wow: "😮", heart: "❤️", haha: "😂" };
      // Find the note author's email
      const writerName = note.writer.toLowerCase();
      for (const staff of allStaff) {
        if (staff.email.toLowerCase() === lowerEmail) continue;
        if (staff.name.toLowerCase() === writerName || staff.name.toLowerCase().includes(writerName)) {
          await ctx.db.insert("notifications", {
            type: "reaction",
            targetEmail: staff.email.toLowerCase(),
            actorEmail: lowerEmail,
            actorName: args.userName || lowerEmail,
            message: `reacted ${emojiMap[key] || key} to your note on "${task.title}"`,
            taskId: args.taskId,
            taskTitle: task.title,
            read: false,
            createdAt: Date.now(),
          });
          break;
        }
      }
    }
  },
});

export const addNoteReply = mutation({
  args: {
    taskId: v.id("tasks"),
    noteIndex: v.number(),
    replyText: v.string(),
    writer: v.string(),
    writerEmail: v.optional(v.string()),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const notes = [...(task.notes || [])];
    if (args.noteIndex < 0 || args.noteIndex >= notes.length) return;

    const note = { ...notes[args.noteIndex] };
    const replies = [...(note.replies || [])];

    replies.push({
      text: args.replyText,
      writer: args.writer,
      date: args.date,
      timestamp: Date.now(),
    });

    note.replies = replies;
    notes[args.noteIndex] = note;

    await ctx.db.patch(args.taskId, { notes });

    // --- Notification: notify original note author of reply ---
    const actorEmail = (args.writerEmail || "").toLowerCase();
    if (note.writer) {
      const allStaff = await ctx.db.query("staff").collect();
      const writerName = note.writer.toLowerCase();
      for (const staff of allStaff) {
        if (staff.email.toLowerCase() === actorEmail) continue;
        if (staff.name.toLowerCase() === writerName || staff.name.toLowerCase().includes(writerName)) {
          await ctx.db.insert("notifications", {
            type: "project_change",
            targetEmail: staff.email.toLowerCase(),
            actorEmail,
            actorName: args.writer,
            message: `replied to your note on "${task.title}"`,
            taskId: args.taskId,
            taskTitle: task.title,
            read: false,
            createdAt: Date.now(),
          });
          break;
        }
      }
    }

    // Parse @mentions from reply text
    const mentions = args.replyText.match(/@([\w\s]+?)(?=[@,.]|$)/g);
    if (mentions) {
      const allStaff = await ctx.db.query("staff").collect();
      for (const mention of mentions) {
        const mentionedName = mention.substring(1).trim().toLowerCase();
        for (const staff of allStaff) {
          if (staff.email.toLowerCase() === actorEmail) continue;
          if (staff.name.toLowerCase().includes(mentionedName) || mentionedName.includes(staff.name.toLowerCase().split(" ")[0])) {
            await ctx.db.insert("notifications", {
              type: "mention",
              targetEmail: staff.email.toLowerCase(),
              actorEmail,
              actorName: args.writer,
              message: `mentioned you in a reply on "${task.title}"`,
              taskId: args.taskId,
              taskTitle: task.title,
              read: false,
              createdAt: Date.now(),
            });
          }
        }
      }
    }

    return replies;
  },
});

// ==========================================
// BULK DELETIONS
// ==========================================

export const deleteTaskNotesBulk = mutation({
  args: {
    taskId: v.id("tasks"),
    indices: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const currentNotes = task.notes || [];
    const indicesSet = new Set(args.indices);
    const updatedNotes = currentNotes.filter((_, i) => !indicesSet.has(i));
    await ctx.db.patch(args.taskId, {
      notes: updatedNotes,
      lastUpdated: Date.now(),
    });
  },
});

export const deleteTaskFeaturesBulk = mutation({
  args: {
    taskId: v.id("tasks"),
    featureIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const idSet = new Set(args.featureIds);
    const updatedFeatures = (task.features || []).filter((f) => !idSet.has(f.id));
    await ctx.db.patch(args.taskId, {
      features: updatedFeatures,
      lastUpdated: Date.now(),
    });
  },
});

export const deleteTaskMilestonesBulk = mutation({
  args: {
    taskId: v.id("tasks"),
    indices: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");
    const indicesSet = new Set(args.indices);
    const updatedMilestones = (task.milestones || []).filter((_, i) => !indicesSet.has(i));
    
    const completedCount = updatedMilestones.filter(m => m.completed).length;
    await ctx.db.patch(args.taskId, {
      milestones: updatedMilestones,
      completedMilestones: completedCount,
      lastUpdated: Date.now(),
    });
  },
});

export const migrateAllAdminCredentials = mutation({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    let count = 0;
    for (const task of tasks) {
      if (task.adminCredentials && !task.adminCredentials.password.startsWith("obf_")) {
        await ctx.db.patch(task._id, {
          adminCredentials: {
            email: obfuscate(task.adminCredentials.email),
            password: obfuscate(task.adminCredentials.password)
          }
        });
        count++;
      }
    }
    return { migrated: count };
  },
});
