/**
 * Shared deadline math for projects.
 *
 * Two different deadlines exist per project:
 *   • milestoneDue  — when the ACTIVE milestone is due (shown in the task modal)
 *   • completionDue — when ALL remaining milestone days run out = project
 *                     completion (highlighted on dashboards / kanban cards)
 *
 * Admins can pin an explicit completion deadline on a task
 * (task.deadlineOverride, set via right-click → Edit Deadline). When present
 * it replaces the computed completion date.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function getProjectDeadlines(t) {
  const ms = t.milestones || [];
  const override = t.deadlineOverride || null;
  if (ms.length === 0 && !override) return null;

  const totalDays = ms.reduce((s, m) => s + (m.days || 0), 0);
  const idx = ms.findIndex((m) => !m.completed);
  if (ms.length > 0 && idx === -1) return { complete: true, totalDays };

  let milestoneDue = null;
  let computedCompletion = null;
  let activeName = null;

  if (idx !== -1) {
    const active = ms[idx];
    activeName = active.name;
    // The active milestone's window starts when the previous one completed —
    // the same anchoring the overdue logic uses everywhere else.
    const anchor =
      (idx > 0
        ? ms[idx - 1].completedAtTime || ms[idx - 1].createdAtTime
        : active.createdAtTime) || t.lastUpdated;
    if (anchor) {
      const remainingDays = ms.slice(idx).reduce((s, m) => s + (m.days || 0), 0);
      milestoneDue = anchor + (active.days || 0) * DAY_MS;
      computedCompletion = anchor + remainingDays * DAY_MS;
    }
  }

  const completionDue = override || computedCompletion;
  if (!completionDue) return null;

  return {
    totalDays,
    activeName,
    milestoneDue,
    completionDue,
    overridden: !!override,
    doneCount: idx === -1 ? ms.length : idx,
    count: ms.length,
  };
}

/* Days-left tone: overdue → red, ≤7d → orange, ≤30d → amber, else brand */
export function deadlineTone(daysLeft) {
  if (daysLeft < 0) return "overdue";
  if (daysLeft <= 7) return "urgent";
  if (daysLeft <= 30) return "soon";
  return "ok";
}
