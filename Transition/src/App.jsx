import { useState, useEffect, useMemo, useRef } from "react";
import { applySettings, loadSettings, saveSettings } from "./utils/settingsManager";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { initNotifications } from "./utils/notifications";
import Dashboard from "./components/Dashboard";
import KanbanBoard from "./components/KanbanBoard";
import TaskEntry from "./components/TaskEntry";
import Notebook from "./components/Notebook";
import AdminPanel from "./components/AdminPanel";
import TaskModal from "./components/TaskModal";
import Login from "./components/Login";
import SetPassword from "./components/SetPassword";
import CustomModal from "./components/CustomModal";
import InputModal from "./components/InputModal";
import IntroAnimation from "./components/IntroAnimation";
import AnnouncementPopup from "./components/AnnouncementPopup";
import AnnouncementComposer from "./components/AnnouncementComposer";
import TaskNotificationPopup from "./components/TaskNotificationPopup";
import Settings from "./components/Settings";

const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll"];

export default function App() {
  // --- Refs ---
  const hasSetInitialView = useRef(false);

  // --- Auth state ---
  const [sessionExpiredPending, setSessionExpiredPending] = useState(false);
  const [authStage, setAuthStage] = useState(() => {
    // "login" | "set-password" | "authenticated" | "denied"
    if (localStorage.getItem("wf_authenticated") === "true") {
      const email = localStorage.getItem("wf_email");
      if (!email) {
        localStorage.clear();
        return "login";
      }
      // Check if session has expired (7 hours of inactivity)
      const INACTIVITY_LIMIT_MS = 7 * 60 * 60 * 1000;
      const lastActivity = parseInt(localStorage.getItem("wf_last_activity") || "0", 10);
      if (lastActivity > 0 && (Date.now() - lastActivity) > INACTIVITY_LIMIT_MS) {
        // Flag for the useEffect to handle
        localStorage.setItem("wf_session_expired_on_load", "true");
      }
      return "authenticated";
    }
    return "login";
  });
  const [pendingEmail, setPendingEmail] = useState(""); // used during set-password flow
  const [loginError, setLoginError] = useState("");     // error passed back to Login

  // --- App state ---
  const [currentView, setCurrentView] = useState("dashboard");
  const [userRole, setUserRole] = useState("Admin");
  const [actualRole, setActualRole] = useState("Admin");
  const [userName, setUserName] = useState("");
  const [isMainAdmin, setIsMainAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userAvatar, setUserAvatar] = useState("");
  const [modalTaskId, setModalTaskId] = useState(null);
  const [modalEditMode, setModalEditMode] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, task: null });
  const [showIntro, setShowIntro] = useState(() => {
    // Show intro on auto-login (user didn't log out)
    return localStorage.getItem("wf_authenticated") === "true";
  });
  const [showSettings, setShowSettings] = useState(false);
  const [viewingStaff, setViewingStaff] = useState(null);

  const [showLoginNotifications, setShowLoginNotifications] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showRoleSwitcherPopup, setShowRoleSwitcherPopup] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "alert",
    onConfirm: () => { },
    onCancel: () => { },
  });
  const [inputModal, setInputModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    fields: [],
    onConfirm: () => { },
  });

  // --- Convex ---
  const staff = useQuery(api.staff.getStaff);
  const tasks = useQuery(api.tasks.getTasks);
  const addStaffMutation = useMutation(api.staff.addStaff);
  const setPasswordMutation = useMutation(api.staff.setPassword);
  const deleteStaffMutation = useMutation(api.staff.deleteStaff);
  const deleteTask = useMutation(api.tasks.deleteTask);
  const updateProjectLink = useMutation(api.tasks.updateProjectLink);
  const updateAdminCredentials = useMutation(api.tasks.updateAdminCredentials);
  const heartbeatMutation = useMutation(api.staff.heartbeat);

  const activeProfile = useMemo(() => {
    if (!viewingStaff) return null;
    return staff?.find(s => s.email.toLowerCase() === viewingStaff.email.toLowerCase()) || viewingStaff;
  }, [viewingStaff, staff]);

  // --- Resolve user once authenticated and staff loaded ---
  useEffect(() => {
    if (authStage !== "authenticated") {
      setLoading(false);
      return;
    }

    if (staff === undefined) return; // still loading from Convex

    const email = localStorage.getItem("wf_email") || "";
    if (!email) {
      localStorage.removeItem("wf_authenticated");
      setAuthStage("login");
      setLoading(false);
      return;
    }

    const settings = loadSettings();
    const mainAdmin = email === "wmt@ececontactcenters.com";
    const user = staff.find((s) => (s.email || "").toLowerCase() === email);

    // --- Apply default view from settings ---
    const viewMap = { "Dashboard": "dashboard", "Projects": "kanban", "Activity Feed": "entry", "Notebook": "notebook" };
    const mappedView = viewMap[settings.defaultView] || "dashboard";

    if (mainAdmin) {
      setUserName(user?.name || "Main Admin");
      setUserAvatar(user?.avatarUrl || "");
      setIsMainAdmin(true);
      const dbRole = user?.role || "Admin";
      setActualRole(dbRole);
      setUserRole(dbRole === "Admin+" ? "Admin" : dbRole);
      if (!hasSetInitialView.current) {
        setCurrentView(mappedView);
        hasSetInitialView.current = true;
      }
      setLoading(false);
      return;
    }
    if (user) {
      if (user.role === "Revoked") {
        logout();
        return;
      }

      // Always use the database as the source of truth for profile data
      setUserName(user.name || "User");
      setUserAvatar(user.avatarUrl || "");

      setActualRole(user.role);
      // Admin+ users see the Admin view by default (they have all Admin privileges)
      setUserRole(user.role === "Admin+" ? "Admin" : user.role);
      if (!hasSetInitialView.current) {
        if (user.role === "Programmer") {
          setCurrentView("kanban");
        } else {
          setCurrentView(mappedView);
        }
        hasSetInitialView.current = true;
      }
    }
    setLoading(false);
  }, [staff, authStage, showSettings]);

  // --- Initialize notifications and activity tracking on authentication ---
  useEffect(() => {
    if (authStage !== "authenticated") return;

    initNotifications();

    // Heartbeat for "Last Seen"
    const email = localStorage.getItem("wf_email");
    if (!email) return;

    let throttleTimer;

    const interval = setInterval(() => {
      heartbeatMutation({ email });
    }, 120000); // 2 minutes heartbeat

    heartbeatMutation({ email }); // Initial beat

    // --- Session Expiry check on load ---
    if (localStorage.getItem("wf_session_expired_on_load") === "true") {
      localStorage.removeItem("wf_session_expired_on_load");
      showModal({
        title: "Session Expired",
        message: "Your session has expired. Please log in again.",
        type: "alert",
        onConfirm: () => {
          logout();
        }
      });
      return; 
    }

    // --- Track last activity ---
    const handleActivity = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        localStorage.setItem("wf_last_activity", Date.now().toString());
        throttleTimer = null;
      }, 5000);
    };

    // Record initial activity
    localStorage.setItem("wf_last_activity", Date.now().toString());
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, handleActivity));

    // Show session expired modal if flagged from a previous expired session
    if (localStorage.getItem("wf_session_expired") === "true") {
      // Don't show immediately — wait until after intro animation
      setSessionExpiredPending(true);
      localStorage.removeItem("wf_session_expired");
    }

    return () => {
      clearInterval(interval);
      clearTimeout(throttleTimer);
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, handleActivity));
    };
  }, [authStage]);

  // --- Apply saved settings on mount ---
  useEffect(() => {
    applySettings();
  }, []);

  // --- Body scroll lock (Unified) ---
  useEffect(() => {
    const isModalOpen = !!modalTaskId || modalConfig.isOpen || inputModal.isOpen;
    const authRestricted = authStage !== "authenticated";

    if (isModalOpen || authRestricted) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => { document.body.style.overflow = ""; };
  }, [authStage, modalTaskId, modalConfig.isOpen, inputModal.isOpen]);

  // --- Role class on body ---
  useEffect(() => {
    document.body.classList.remove("role-admin", "role-programmer", "role-admin+");
    document.body.classList.add("role-" + userRole.toLowerCase().replace("+", "plus"));
  }, [userRole]);

  // --- Context menu close ---
  useEffect(() => {
    const handler = () => setContextMenu((prev) => ({ ...prev, visible: false }));
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // -------------------------------------------------------
  // Login handler — this is called when the user submits
  // the login form with their email and password.
  // -------------------------------------------------------
  async function handleLogin(email, password) {
    setLoginError("");
    const lowerEmail = email.toLowerCase();

    // Must wait for staff to be loaded
    if (staff === undefined) {
      setLoginError("System is still loading. Please wait a moment and try again.");
      return;
    }

    const isMainAdmin = lowerEmail === "wmt@ececontactcenters.com";

    if (isMainAdmin) {
      if (password === "admin") {
        localStorage.setItem("wf_authenticated", "true");
        localStorage.setItem("wf_email", lowerEmail);
        localStorage.setItem("wf_last_activity", Date.now().toString());
        setLoading(true);
        setShowIntro(true);
        setAuthStage("authenticated");
      } else {
        setLoginError("Incorrect password.");
      }
      return;
    }

    const user = staff.find((s) => (s.email || "").toLowerCase() === lowerEmail);

    if (!user) {
      // Not in staff list — must register with "admin"
      if (password === "admin") {
        const defaultName = lowerEmail.split("@")[0];
        addStaffMutation({ name: defaultName, email: lowerEmail, role: "Pending" });
        // Show access denied — admin must approve them
        localStorage.setItem("wf_authenticated", "true");
        localStorage.setItem("wf_email", lowerEmail);
        setAuthStage("denied");
      } else {
        setLoginError("You are not registered. Use the default password to register.");
      }
      return;
    }

    // User is marked as pending approval
    if (user.role === "Pending") {
      localStorage.setItem("wf_authenticated", "true");
      localStorage.setItem("wf_email", lowerEmail);
      setAuthStage("denied");
      return;
    }

    if (user.role === "Revoked") {
      setLoginError("Your access has been revoked by an administrator.");
      return;
    }

    // User IS in staff list
    if (!user.password) {
      // No personal password set: only "admin" is accepted  → go to set-password
      if (password === "admin") {
        setPendingEmail(lowerEmail);
        setAuthStage("set-password");
      } else {
        setLoginError("Incorrect password.");
      }
      return;
    }

    // User has a personal password
    if (password === user.password) {
      localStorage.setItem("wf_authenticated", "true");
      localStorage.setItem("wf_email", lowerEmail);
      localStorage.setItem("wf_last_activity", Date.now().toString());
      setLoading(true);
      setShowIntro(true);
      setAuthStage("authenticated");
      // Trigger notification popup for programmers after login
      if (user.role === "Programmer") {
        setShowLoginNotifications(true);
      }
    } else {
      setLoginError("Incorrect password.");
    }
  }

  // -------------------------------------------------------
  // Set-password handler
  // -------------------------------------------------------
  async function handleSetPassword(newPassword) {
    await setPasswordMutation({ email: pendingEmail, password: newPassword });
    localStorage.setItem("wf_authenticated", "true");
    localStorage.setItem("wf_email", pendingEmail);
    setLoading(true);
    setShowIntro(true);
    setAuthStage("authenticated");
  }

  function logout() {
    localStorage.removeItem("wf_authenticated");
    localStorage.removeItem("wf_email");
    setAuthStage("login");
    setLoading(true);
    setUserName("");
    setActualRole("Admin");
    setUserRole("Admin");
    setCurrentView("dashboard");
  }

  function changeRole(role) {
    setUserRole(role);
    if (role === "Programmer") setCurrentView("kanban");
    if (role === "Admin" || role === "Admin+") setCurrentView("dashboard");
  }

  function switchView(viewId) {
    const adminViews = ["admin", "dashboard", "announcements"];
    if (userRole === "Programmer" && adminViews.includes(viewId)) return;
    setCurrentView(viewId);
  }

  function openTaskModal(taskId, editMode = false) {
    setModalTaskId(taskId);
    setModalEditMode(editMode);
  }

  function closeTaskModal() {
    setModalTaskId(null);
    setModalEditMode(false);
  }

  function handleContextMenu(e, task) {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.pageX, y: e.pageY, task });
  }

  /**
   * Shows a custom alert or confirmation modal.
   * @param {Object} options { title, message, type, onConfirm }
   */
  function showModal({ title, message, type = "alert", onConfirm }) {
    setModalConfig({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => {
        if (onConfirm) onConfirm();
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
      onCancel: () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
      },
    });
  }



  function showInputModal({ title, message, fields, onConfirm }) {
    setInputModal({
      isOpen: true,
      title,
      message,
      fields,
      onConfirm: (data) => {
        onConfirm(data);
        setInputModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  }

  // -------------------------------------------------------
  // Render stages
  // -------------------------------------------------------
  if (authStage === "login") {
    return <Login onLogin={handleLogin} externalError={loginError} onResetSuccess={(email) => { setPendingEmail(email); setAuthStage("set-password"); }} />;
  }

  if (authStage === "set-password") {
    return <SetPassword email={pendingEmail} onSet={handleSetPassword} />;
  }

  if (authStage === "denied") {
    return (
      <div className="login-container">
        <div className="header-box" style={{ marginBottom: 30 }}>
          <img src="https://i.imgur.com/BRd5lrB.png" alt="ECE Logo" className="header-logo" />
          <div className="header-text-content">
            <h1>WORKFORCE HERMES</h1>
            <p>Workforce Programming Project Database</p>
          </div>
          <img src="https://i.imgur.com/ycmU6oP.png" alt="WFM Logo" className="header-logo" />
        </div>
        <div style={{ background: "white", padding: 40, borderRadius: 24, boxShadow: "0 10px 25px rgba(0,0,0,0.1)", maxWidth: 420, textAlign: "center" }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" style={{ marginBottom: 20 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2 style={{ color: "var(--color-text-primary)", marginBottom: 10 }}>Access Restricted</h2>
          <p style={{ color: "#64748b", lineHeight: 1.6 }}>
            {staff?.find(s => s.email.toLowerCase() === localStorage.getItem("wf_email")?.toLowerCase())?.role === "Revoked"
              ? "Your access has been revoked. Please contact an administrator if you believe this is an error."
              : "Your email has been registered. Please wait for an administrator to approve your access."}
          </p>
          <p style={{ marginTop: 15, fontWeight: 700, color: "#4355f1", fontSize: "0.85rem" }}>
            {localStorage.getItem("wf_email")}
          </p>
          <button
            className="btn-secondary"
            style={{ marginTop: 25, padding: "10px 24px", background: "var(--color-logout)" }}
            onClick={logout}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loader"></div>
        <div className="loading-text">LOADING...</div>
      </div>
    );
  }

  // -------------------------------------------------------
  // Main app
  // -------------------------------------------------------
  return (
    <>
      {/* Header */}
      <header>
        <div className="header-container">
          <div className="user-profile" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "12px", width: "auto", minWidth: 200 }}>
            <div 
              className="header-avatar-container"
              onClick={() => {
                const settings = loadSettings();
                const user = staff?.find(s => s.email.toLowerCase() === (localStorage.getItem("wf_email") || "").toLowerCase());
                setViewingStaff(user || {
                  name: userName,
                  email: localStorage.getItem("wf_email"),
                  role: actualRole,
                  avatarUrl: userAvatar,
                  bio: settings.bio,
                  country: settings.country,
                  status: settings.status
                });
              }}
              style={{ cursor: "pointer", position: "relative" }}
            >
              {userAvatar ? (
                <img src={userAvatar} alt="Profile" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--color-accent)" }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--color-bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--color-accent)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-start" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 900, color: "var(--color-text-primary)" }}>{userName}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", position: "relative" }}>
                <div 
                  className="role-badge" 
                  style={{ 
                    padding: "2px 8px", 
                    borderRadius: "6px", 
                    fontSize: "0.6rem", 
                    letterSpacing: "0.5px",
                    cursor: (!isMainAdmin && (actualRole === "Admin" || actualRole === "Admin+")) ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center"
                  }}
                  onClick={() => {
                    if (!isMainAdmin && (actualRole === "Admin" || actualRole === "Admin+")) {
                      setShowRoleSwitcherPopup(!showRoleSwitcherPopup);
                    }
                  }}
                  title={(!isMainAdmin && (actualRole === "Admin" || actualRole === "Admin+")) ? "Click to switch view" : ""}
                >
                  {actualRole === "Admin+" ? "Admin+" : userRole}
                  {(!isMainAdmin && (actualRole === "Admin" || actualRole === "Admin+")) && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginLeft: 4 }}><path d="M6 9l6 6 6-6"/></svg>
                  )}
                </div>
                
                {showRoleSwitcherPopup && (
                  <>
                    <div 
                      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }} 
                      onClick={() => setShowRoleSwitcherPopup(false)} 
                    />
                    <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "6px", background: "var(--color-bg-primary)", border: "1px solid var(--glass-border)", borderRadius: "8px", boxShadow: "var(--shadow-md)", zIndex: 100, minWidth: "140px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <div 
                        style={{ padding: "8px 12px", fontSize: "0.75rem", cursor: "pointer", background: userRole === "Admin" ? "var(--color-bg-subtle)" : "transparent", color: userRole === "Admin" ? "var(--color-accent)" : "var(--color-text-primary)", fontWeight: userRole === "Admin" ? 800 : 500, transition: "background 0.2s" }}
                        onClick={() => { changeRole("Admin"); setShowRoleSwitcherPopup(false); }}
                        onMouseEnter={(e) => { if(userRole !== "Admin") e.currentTarget.style.background = "var(--glass-bg)" }}
                        onMouseLeave={(e) => { if(userRole !== "Admin") e.currentTarget.style.background = "transparent" }}
                      >
                        Admin View
                      </div>
                      <div 
                        style={{ padding: "8px 12px", fontSize: "0.75rem", cursor: "pointer", background: userRole === "Programmer" ? "var(--color-bg-subtle)" : "transparent", color: userRole === "Programmer" ? "var(--color-accent)" : "var(--color-text-primary)", fontWeight: userRole === "Programmer" ? 800 : 500, transition: "background 0.2s" }}
                        onClick={() => { changeRole("Programmer"); setShowRoleSwitcherPopup(false); }}
                        onMouseEnter={(e) => { if(userRole !== "Programmer") e.currentTarget.style.background = "var(--glass-bg)" }}
                        onMouseLeave={(e) => { if(userRole !== "Programmer") e.currentTarget.style.background = "transparent" }}
                      >
                        Programmer View
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <button
              className="btn-settings-header"
              onClick={() => setShowSettings(true)}
              title="Settings"
              style={{ padding: "8px", borderRadius: "50%", marginLeft: "4px" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1-2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
          <div className="header-box" style={{ padding: "10px 30px", borderRadius: "20px", border: "1px solid var(--glass-border)", background: "var(--glass-bg)", boxShadow: "var(--shadow-md)" }}>
            <img src="https://i.imgur.com/BRd5lrB.png" alt="ECE Logo" className="header-logo" style={{ height: "45px" }} />
            <div className="header-text-content">
              <h1 style={{ fontSize: "1.6rem", letterSpacing: "-1.2px" }}>WORKFORCE HERMES</h1>
              <p style={{ fontSize: "0.75rem", letterSpacing: "0.8px", color: "var(--color-text-secondary)", fontWeight: 700 }}>Workforce Programming Project Database</p>
            </div>
            <img src="https://i.imgur.com/ycmU6oP.png" alt="WFM Logo" className="header-logo" style={{ height: "45px" }} />
            <div style={{ width: "1px", height: "30px", background: "var(--glass-border)", margin: "0 10px" }}></div>
            <button 
              className="btn-project-consolidation"
              onClick={() => setShowAllProjects(true)}
              title="View All Project Links"
              style={{ 
                padding: "8px 16px", 
                borderRadius: "12px", 
                border: "1px solid var(--color-accent)", 
                background: "linear-gradient(135deg, var(--color-accent), var(--color-nav-bg))",
                color: "white",
                fontSize: "0.7rem",
                fontWeight: 900,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              PROJECT LINKS
            </button>
          </div>
        </div>

        <div className="nav-bar" style={{ padding: "12px 0 20px 0" }}>
          <div className="nav-label" style={{ marginBottom: "12px", fontSize: "0.65rem", letterSpacing: "3px", opacity: 0.6 }}>NAVIGATION &amp; QUICK ACTIONS</div>
          <div className="nav-links">
            {(userRole === "Admin" || userRole === "Admin+") && (
              <div
                className={`nav-btn ${currentView === "dashboard" ? "active" : ""}`}
                onClick={() => switchView("dashboard")}
              >
                OVERVIEW
              </div>
            )}
            <div
              className={`nav-btn ${currentView === "kanban" ? "active" : ""}`}
              onClick={() => switchView("kanban")}
            >
              DASHBOARD
            </div>
            <div
              className={`nav-btn highlight ${currentView === "entry" ? "active" : ""}`}
              onClick={() => switchView("entry")}
            >
              NEW TASK
            </div>
            <div
              className={`nav-btn ${currentView === "notebook" ? "active" : ""}`}
              onClick={() => switchView("notebook")}
            >
              NOTEBOOK
            </div>

            {actualRole === "Admin+" && (
              <div
                className={`nav-btn ${currentView === "announcements" ? "active" : ""}`}
                onClick={() => switchView("announcements")}
                style={{ display: "flex", alignItems: "center", gap: 5 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                ANNOUNCEMENTS
              </div>
            )}

          </div>
        </div>
      </header>

      {/* Views */}
      {currentView === "dashboard" && <Dashboard />}
      {currentView === "kanban" && (
        <KanbanBoard
          userRole={userRole}
          actualRole={actualRole}
          userName={userName}
          openTaskModal={openTaskModal}
          onContextMenu={handleContextMenu}
          showModal={showModal}
          staff={staff || []}
        />
      )}
      {currentView === "entry" && (
        <TaskEntry
          userRole={userRole}
          userName={userName}
          onCreated={() => switchView("kanban")}
          showModal={showModal}
        />
      )}
      {currentView === "notebook" && (
        <Notebook userRole={userRole} userName={userName} showModal={showModal} />
      )}

      {currentView === "announcements" && actualRole === "Admin+" && (
        <AnnouncementComposer userName={userName} showModal={showModal} />
      )}

      {/* Task Modal */}
      {modalTaskId && (
        <TaskModal
          taskId={modalTaskId}
          isEditMode={modalEditMode}
          userRole={userRole}
          actualRole={actualRole}
          userName={userName}
          staff={staff || []}
          onClose={closeTaskModal}
          showModal={showModal}
          onViewProfile={(s) => setViewingStaff(s)}
        />
      )}

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <div
            className="context-menu-item"
            onClick={() => {
              openTaskModal(contextMenu.task._id, true);
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit Task
          </div>

          {contextMenu.task.assignee.toLowerCase().includes(userName.toLowerCase()) && (
            <>
              <div
                className="context-menu-item"
                onClick={() => {
                  if (!contextMenu.task || !contextMenu.task._id) return;
                  showInputModal({
                    title: "Project Link",
                    message: "Enter the direct link for this project workspace.",
                    fields: [{ name: "link", label: "Project URL", placeholder: "https://...", initialValue: contextMenu.task.projectLink }],
                    onConfirm: (data) => {
                      console.log("Saving Project Link for ID:", contextMenu.task._id, data.link);
                      updateProjectLink({ taskId: contextMenu.task._id, projectLink: data.link })
                        .catch(err => console.error("Project Link Mutation Error:", err));
                    }
                  });
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                {contextMenu.task.projectLink ? "Edit Project Link" : "Add Project Link"}
              </div>
              <div
                className="context-menu-item"
                onClick={() => {
                  if (!contextMenu.task || !contextMenu.task._id) return;
                  showInputModal({
                    title: "Admin Credentials",
                    message: "Provide login details for administrative access.",
                    fields: [
                      { name: "email", label: "Email / Username", placeholder: "email@example.com", initialValue: contextMenu.task.adminCredentials?.email },
                      { name: "password", label: "Password", placeholder: "••••••••", type: "password", initialValue: contextMenu.task.adminCredentials?.password }
                    ],
                    onConfirm: (data) => {
                      console.log("Saving Admin Creds for ID:", contextMenu.task._id, data);
                      updateAdminCredentials({ taskId: contextMenu.task._id, email: data.email, password: data.password })
                        .catch(err => console.error("Admin Cred Mutation Error:", err));
                    }
                  });
                  setContextMenu((prev) => ({ ...prev, visible: false }));
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                {contextMenu.task.adminCredentials ? "Edit Admin Credentials" : "Add Admin Credentials"}
              </div>
            </>
          )}

          <div
            className="context-menu-item delete-option"
            onClick={() => {
              showModal({
                title: "Delete Project",
                message: "Are you sure you want to permanently delete this project? This action cannot be undone.",
                type: "confirm",
                onConfirm: () => deleteTask({ taskId: contextMenu.task._id })
              });
              setContextMenu((prev) => ({ ...prev, visible: false }));
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete Task
          </div>
        </div>
      )}

      {/* Custom Alert/Confirm Modal */}
      <CustomModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
      />

      <InputModal
        isOpen={inputModal.isOpen}
        title={inputModal.title}
        message={inputModal.message}
        fields={inputModal.fields}
        onConfirm={inputModal.onConfirm}
        onCancel={() => setInputModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Announcement Popup — real-time, shows for all authenticated users */}
      <AnnouncementPopup />

      {/* Task Notification Popup — shows on login for Programmers */}
      {showLoginNotifications && (
        <TaskNotificationPopup
          userName={userName}
          onDismiss={() => setShowLoginNotifications(false)}
          onOpenTask={(taskId) => {
            openTaskModal(taskId);
            setShowLoginNotifications(false);
          }}
        />
      )}

      {/* Settings Panel */}
      {showSettings && (
        <Settings
          userName={userName}
          userEmail={localStorage.getItem("wf_email") || ""}
          onClose={() => setShowSettings(false)}
          showModal={showModal}
          onLogout={logout}
          actualRole={actualRole}
          onViewProfile={(s) => setViewingStaff(s)}
        />
      )}

      {/* Profile Popover */}
      {activeProfile && (
        <div className="profile-popover-overlay" onClick={() => setViewingStaff(null)}>
          <div className="profile-popover-content" onClick={(e) => e.stopPropagation()}>
            <div className="profile-popover-header" style={{ backgroundImage: activeProfile.avatarUrl ? `url(${activeProfile.avatarUrl})` : "none" }}>
              <div className="profile-popover-avatar-large">
                {activeProfile.avatarUrl ? (
                  <img src={activeProfile.avatarUrl} alt={activeProfile.name} />
                ) : (
                  <div className="avatar-placeholder-large">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                )}
              </div>
              <button className="profile-popover-close" onClick={() => setViewingStaff(null)}>×</button>
            </div>
            <div className="profile-popover-body">
              <div className="profile-popover-main">
                <div className="profile-popover-name-row">
                  <div className={`status-indicator ${(Date.now() - (activeProfile.lastSeen || 0)) < 3600000 ? "active" : ""}`} />
                  <h3>{activeProfile.name}</h3>
                </div>
                <div className="profile-popover-email">
                  {activeProfile.email}
                </div>
                <div className="profile-popover-badges" style={{ display: "flex", gap: "10px", marginBottom: "15px", flexWrap: "wrap" }}>
                  <div className="profile-popover-status location" style={{ marginBottom: 0, background: "var(--color-bg-subtle)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {activeProfile.country || "Philippines"}
                  </div>
                  <div className="profile-popover-status" style={{ marginBottom: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {activeProfile.status || "At work"}
                  </div>
                </div>

                <div className="profile-popover-meta">
                  <div className="meta-item">
                    <span className="meta-label">Last seen:</span>
                    <span className="meta-value">
                      {activeProfile.lastSeen ? (
                        (Date.now() - activeProfile.lastSeen < 60000) ? "Just now" :
                          (Date.now() - activeProfile.lastSeen < 86400000) ?
                            new Date(activeProfile.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                            new Date(activeProfile.lastSeen).toLocaleDateString()
                      ) : "Never"}
                    </span>
                  </div>
                </div>

                {activeProfile.bio && (
                  <div className="profile-popover-bio">
                    {activeProfile.bio}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Projects Modal */}
      {showAllProjects && (
        <div className="modal-overlay" onClick={() => setShowAllProjects(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1200, height: "auto", maxHeight: "80vh" }}>
            <button className="modal-close" onClick={() => setShowAllProjects(false)}>×</button>
            <h2 style={{ 
              fontWeight: 900, 
              textTransform: "uppercase", 
              marginBottom: 25, 
              paddingBottom: 15,
              borderBottom: "1px solid #f1f5f9",
              color: "var(--color-text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span>Consolidated Project Links</span>
            </h2>
            
            <div className="full-kanban-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
              {tasks?.filter(t => t.projectLink).map(t => (
                <div 
                  key={t._id} 
                  className="programmer-card" 
                  onClick={() => window.open(t.projectLink.startsWith("http") ? t.projectLink : `https://${t.projectLink}`, "_blank")}
                  style={{ 
                    borderTop: "6px solid var(--color-accent)",
                    transition: "transform 0.2s, box-shadow 0.2s"
                  }}
                >
                  <div className="card-header">
                    <h4 style={{ color: "var(--color-text-primary)" }}>{t.title}</h4>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="3">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "5px 0 15px 0", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {t.description || "No description provided."}
                  </p>
                  <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--color-accent)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Open Project Link →
                  </div>
                </div>
              ))}
              {tasks?.filter(t => t.projectLink).length === 0 && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                  No projects with links found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Intro Animation Overlay */}
      {showIntro && <IntroAnimation onDone={() => {
        setShowIntro(false);
        if (sessionExpiredPending) {
          setSessionExpiredPending(false);
          showModal({
            title: "Session Expired",
            message: "Your session has expired. Please log in again.",
            type: "alert",
          });
        }
      }} />}
    </>
  );
}
