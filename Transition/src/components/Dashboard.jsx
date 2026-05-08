import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Dashboard() {
  const stats = useQuery(api.tasks.getProjectStats);

  if (!stats) {
    return (
      <div className="container">
        <p style={{ color: "#94a3b8", fontStyle: "italic", textAlign: "center" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div id="dashboard-view" className="view-section">
      <div className="container">
        {/* Consolidated System Links */}
        {stats.projectsWithLinks && stats.projectsWithLinks.length > 0 && (
          <div className="section-card" style={{ marginBottom: 25, background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", border: "1.5px solid #e2e8f0", boxShadow: "var(--shadow-sm)" }}>
            <h2 style={{ fontWeight: 900, marginTop: 0, textTransform: "uppercase", fontSize: "0.85rem", color: "var(--color-text-secondary)", marginBottom: 15, display: "flex", alignItems: "center", gap: 10, letterSpacing: "0.5px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Consolidated System Links
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {stats.projectsWithLinks.map(p => (
                <div key={p.id} style={{ background: "white", padding: "12px 15px", borderRadius: 10, border: "1px solid #e2e8f0", transition: "transform 0.2s ease" }}>
                  <div style={{ fontWeight: 900, fontSize: "0.8rem", marginBottom: 10, color: "var(--color-nav-bg)", borderBottom: "1px solid #f1f5f9", paddingBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {p.webappLink && (
                      <a 
                        href={p.webappLink.startsWith("http") ? p.webappLink : `https://${p.webappLink}`} 
                        target="_blank" rel="noopener noreferrer" 
                        style={{ flex: 1, textAlign: "center", background: "var(--color-accent)", color: "white", padding: "7px 0", borderRadius: 8, fontSize: "0.6rem", fontWeight: 900, textDecoration: "none", letterSpacing: "0.3px" }}
                      >
                        VIEW PROJECT
                      </a>
                    )}
                    {p.appscriptLink && (
                      <a 
                        href={p.appscriptLink.startsWith("http") ? p.appscriptLink : `https://${p.appscriptLink}`} 
                        target="_blank" rel="noopener noreferrer" 
                        style={{ flex: 1, textAlign: "center", background: "#4285f4", color: "white", padding: "7px 0", borderRadius: 8, fontSize: "0.6rem", fontWeight: 900, textDecoration: "none", letterSpacing: "0.3px" }}
                      >
                        APPSCRIPT
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--col-todo)" }}>{stats.todo || 0}</div>
            <div className="stat-label">Queue</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--color-accent)" }}>{stats.development || 0}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--col-test)" }}>{stats.done || 0}</div>
            <div className="stat-label">Deployed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: "var(--color-nav-bg)" }}>{stats.overallCompletion || 0}%</div>
            <div className="stat-label">Efficiency</div>
          </div>
        </div>

        <div className="section-card">
          <h2 style={{ fontWeight: 900, marginTop: 0, textTransform: "uppercase", fontSize: "1.2rem", letterSpacing: "-0.5px" }}>
            System Overview
          </h2>
          <p style={{ color: "var(--color-text-secondary)" }}>
            Welcome to Workforce Hermes. Use the navigation above to manage tasks, staff, and project concepts.
          </p>
        </div>

        <div className="section-card" style={{ marginTop: 20 }}>
          <h2 style={{ fontWeight: 900, marginTop: 0, textTransform: "uppercase", fontSize: "1rem", color: "var(--color-text-primary)", marginBottom: 20 }}>
            👥 Programmer Workload — Active & Pending
          </h2>
          <div>
            {(stats.staffWorkload || []).length === 0 ? (
              <p style={{ color: "#94a3b8", fontStyle: "italic", textAlign: "center" }}>
                No active or pending tasks right now.
              </p>
            ) : (
              stats.staffWorkload.map((w) => (
                <div
                  key={w.name}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 15px",
                    borderRadius: 12,
                    background: "var(--color-bg-subtle)",
                    marginBottom: 10,
                    border: "1px solid var(--glass-border)",
                  }}
                >
                  <div style={{ fontWeight: 900, color: "var(--color-text-primary) !important", fontSize: "0.9rem" }}>{w.name}</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {w.active > 0 && (
                      <span style={{ background: "linear-gradient(135deg, var(--color-nav-bg), var(--color-accent))", color: "white", padding: "3px 10px", borderRadius: 12, fontSize: "0.75rem", fontWeight: 900 }}>
                        Active: {w.active}
                      </span>
                    )}
                    {w.pending > 0 && (
                      <span style={{ background: "linear-gradient(135deg, var(--color-nav-bg), #475569)", color: "white", padding: "3px 10px", borderRadius: 12, fontSize: "0.75rem", fontWeight: 900 }}>
                        Pending: {w.pending}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
