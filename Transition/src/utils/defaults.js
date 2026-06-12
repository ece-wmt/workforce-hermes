/**
 * Org-wide fallback defaults.
 *
 * The live milestone template is stored in Convex (appConfig.defaultMilestones,
 * editable by Admin+ under Settings → Workspace Defaults). This constant is the
 * fallback used before the config loads or when none has been saved yet.
 */
export const FALLBACK_MILESTONES = [
  { name: "Project Planning & Design", days: 22 },
  { name: "Project Setup & Database", days: 6 },
  { name: "Core Feature Development (Phase 1)", days: 25 },
  { name: "Core Feature Development (Phase 2)", days: 20 },
  { name: "API Integration", days: 8 },
  { name: "Internal Testing & Bug Fixes", days: 15 },
  { name: "User Testing & Refinement", days: 20 },
  { name: "Final Polish & Optimization", days: 15 },
  { name: "Deployment & Soft Launch", days: 17 },
  { name: "Post-Launch Support", days: 22 },
];
