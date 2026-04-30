import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { loadSettings, saveSettings, applySettings, DEFAULT_SETTINGS } from "../utils/settingsManager";

const ACCENT_COLORS = [
  { name: "Emerald", value: "#10b981" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Cyan", value: "#06b6d4" },
];

const FONT_SIZES = ["Standard", "Large", "Extra Large"];
const DEFAULT_VIEWS = ["Dashboard", "Projects", "Activity Feed", "Notebook"];

const BASE_SECTIONS = [
  { id: "appearance", label: "Appearance & UI", icon: "palette" },
  { id: "general", label: "General Preferences", icon: "sliders" },
  { id: "account", label: "Account & Profile", icon: "user" },
  { id: "notifications", label: "Notifications", icon: "bell" },
];

function SectionIcon({ icon, size = 18 }) {
  const s = { width: size, height: size, strokeWidth: 2, fill: "none", stroke: "currentColor" };
  switch (icon) {
    case "palette":
      return (<svg viewBox="0 0 24 24" {...s}><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" /><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" stroke="none" /><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" stroke="none" /><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" stroke="none" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg>);
    case "sliders":
      return (<svg viewBox="0 0 24 24" {...s}><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></svg>);
    case "user":
      return (<svg viewBox="0 0 24 24" {...s}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>);
    case "bell":
      return (<svg viewBox="0 0 24 24" {...s}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>);
    case "shield":
      return (<svg viewBox="0 0 24 24" {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);
    default: return null;
  }
}

export default function Settings({ userName, userEmail, onClose, showModal, onLogout, actualRole, onViewProfile }) {
  const [activeSection, setActiveSection] = useState("appearance");
  const [hasChanges, setHasChanges] = useState(false);
  const isAdminPlus = actualRole === "Admin+";
  const SECTIONS = isAdminPlus
    ? [...BASE_SECTIONS, { id: "staff", label: "Staff Management", icon: "shield" }]
    : BASE_SECTIONS;

  const contentRef = useRef(null);
  const savedRef = useRef(null); // snapshot of settings before edits

  // Load saved settings on mount
  const saved = loadSettings();
  if (!savedRef.current) savedRef.current = { ...saved };

  // --- Appearance state ---
  const [theme, setTheme] = useState(saved.theme);
  const [accentColor, setAccentColor] = useState(saved.accentColor);
  const [fontSize, setFontSize] = useState(saved.fontSize);

  // --- General Preferences state ---
  const [defaultView, setDefaultView] = useState(saved.defaultView);
  const [openOnStartup, setOpenOnStartup] = useState(saved.openOnStartup);
  const [startMinimized, setStartMinimized] = useState(saved.startMinimized);

  // --- Account state ---
  const [avatarUrl, setAvatarUrl] = useState(saved.avatarUrl);
  const [username, setUsername] = useState(userName || saved.username || "");
  const [bio, setBio] = useState(saved.bio || "");
  const [country, setCountry] = useState(saved.country || "");
  const [status, setStatus] = useState(saved.status || "");
  const [email, setEmail] = useState(userEmail || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateProfile = useMutation(api.staff.updateProfile);
  const resetPasswordMut = useMutation(api.staff.resetPassword);
  const updateStaffRole = useMutation(api.staff.updateStaffRole);
  const deleteStaffMut = useMutation(api.staff.deleteStaff);
  const addStaffMut = useMutation(api.staff.addStaff);
  const allStaff = useQuery(api.staff.getStaff);

  // Staff management state
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("Programmer");

  const activeStaff = (allStaff || []).filter(s => s.role !== "Pending");
  const pendingRequests = (allStaff || []).filter(s => s.role === "Pending");

  // --- Notifications state ---
  const [notificationsEnabled, setNotificationsEnabled] = useState(saved.notificationsEnabled);
  const [notifyErrors, setNotifyErrors] = useState(saved.notifyErrors);
  const [notifyUpdates, setNotifyUpdates] = useState(saved.notifyUpdates);

  const avatarInputRef = useRef(null);
  const markChanged = () => setHasChanges(true);

  // Scroll to section
  function scrollToSection(sectionId) {
    setActiveSection(sectionId);
    const el = document.getElementById(`settings-section-${sectionId}`);
    if (el && contentRef.current) {
      contentRef.current.scrollTo({ top: el.offsetTop - contentRef.current.offsetTop - 20, behavior: "smooth" });
    }
  }

  // Scroll spy
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const handler = () => {
      const sects = SECTIONS.map((s) => ({ id: s.id, el: document.getElementById(`settings-section-${s.id}`) }));
      const scrollTop = container.scrollTop + 100;
      for (let i = sects.length - 1; i >= 0; i--) {
        if (sects[i].el && sects[i].el.offsetTop - container.offsetTop <= scrollTop) { setActiveSection(sects[i].id); break; }
      }
    };
    container.addEventListener("scroll", handler);
    return () => container.removeEventListener("scroll", handler);
  }, []);

  function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setAvatarUrl(ev.target.result); markChanged(); };
    reader.readAsDataURL(file);
  }

  function buildSettingsObject() {
    return { theme, accentColor, fontSize, defaultView, openOnStartup, startMinimized, notificationsEnabled, notifyErrors, notifyUpdates, avatarUrl, bio, username, country, status };
  }

  async function handleSave() {
    const settings = buildSettingsObject();
    
    // Save locally
    saveSettings(settings);
    applySettings(settings);
    savedRef.current = { ...settings };
    setHasChanges(false);

    // Sync to backend if we have an email
    if (email) {
      try {
        await updateProfile({
          email: email,
          name: username,
          bio: bio,
          avatarUrl: avatarUrl,
          country: country,
          status: status,
        });
      } catch (err) {
        console.error("Failed to sync profile to backend:", err);
      }
    }

    showModal({ title: "Settings Saved", message: "Your preferences have been applied successfully.", type: "success" });
  }

  function handleCancel() {
    if (hasChanges) {
      showModal({
        title: "Discard Changes?",
        message: "You have unsaved changes. Are you sure you want to discard them?",
        type: "confirm",
        onConfirm: () => {
          // Revert to previously saved settings
          applySettings(savedRef.current);
          setHasChanges(false);
          onClose();
        },
      });
    } else {
      onClose();
    }
  }

  function handleDeleteAccount() {
    showModal({
      title: "Delete Account",
      message: "Are you absolutely sure you want to delete your account? This action is permanent and cannot be undone. All your data will be irreversibly lost.",
      type: "confirm",
      onConfirm: () => showModal({ title: "Account Deleted", message: "Your account has been scheduled for deletion.", type: "success" }),
    });
  }

  function handleChangePassword() {
    if (!currentPassword) { showModal({ title: "Error", message: "Please enter your current password.", type: "alert" }); return; }
    if (newPassword.length < 6) { showModal({ title: "Error", message: "New password must be at least 6 characters.", type: "alert" }); return; }
    if (newPassword !== confirmPassword) { showModal({ title: "Error", message: "New passwords do not match.", type: "alert" }); return; }
    showModal({ title: "Password Updated", message: "Your password has been changed successfully.", type: "success" });
    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
  }

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        {/* Header */}
        <div className="settings-header">
          <div className="settings-header-left">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            <h2>Settings</h2>
          </div>
          <button className="settings-close-btn" onClick={handleCancel} title="Close Settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="settings-body">
          {/* Sidebar */}
          <nav className="settings-sidebar">
            {SECTIONS.map((sec) => (
              <button key={sec.id} className={`settings-nav-item ${activeSection === sec.id ? "active" : ""}`} onClick={() => scrollToSection(sec.id)}>
                <SectionIcon icon={sec.icon} size={18} /><span>{sec.label}</span>
              </button>
            ))}
            <div className="settings-sidebar-footer"><div className="settings-sidebar-version">Workforce Hermes v1.0</div></div>
          </nav>

          {/* Content */}
          <div className="settings-content" ref={contentRef}>
            {/* ─── APPEARANCE ─── */}
            <section id="settings-section-appearance" className="settings-section">
              <div className="settings-section-header"><SectionIcon icon="palette" size={20} /><h3>Appearance & UI</h3></div>
              <p className="settings-section-desc">Customize the look and feel of your workspace.</p>

              <div className="settings-card">
                <label className="settings-field-label">Theme</label>
                <div className="settings-segmented-control">
                  {[{ id: "light", label: "Light", icon: "☀️" }, { id: "dark", label: "Dark", icon: "🌙" }, { id: "system", label: "System", icon: "💻" }].map((opt) => (
                    <button key={opt.id} className={`segmented-btn ${theme === opt.id ? "active" : ""}`} onClick={() => { setTheme(opt.id); markChanged(); }}>
                      <span className="segmented-icon">{opt.icon}</span><span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-card">
                <label className="settings-field-label">Accent Color</label>
                <p className="settings-field-hint">Choose a primary brand color for highlights and accents.</p>
                <div className="accent-color-row">
                  {ACCENT_COLORS.map((c) => (
                    <button key={c.value} className={`accent-swatch ${accentColor === c.value ? "active" : ""}`} style={{ "--swatch-color": c.value }} onClick={() => { setAccentColor(c.value); markChanged(); }} title={c.name}>
                      {accentColor === c.value && (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-card">
                <label className="settings-field-label">Text / Font Size</label>
                <select className="settings-select" value={fontSize} onChange={(e) => { setFontSize(e.target.value); markChanged(); }}>
                  {FONT_SIZES.map((fs) => (<option key={fs} value={fs}>{fs}</option>))}
                </select>
              </div>
            </section>

            {/* ─── GENERAL PREFERENCES ─── */}
            <section id="settings-section-general" className="settings-section">
              <div className="settings-section-header"><SectionIcon icon="sliders" size={20} /><h3>General Preferences</h3></div>
              <p className="settings-section-desc">Configure default behaviors and startup options.</p>

              <div className="settings-card">
                <label className="settings-field-label">Default View</label>
                <p className="settings-field-hint">Choose the page that loads when you open the app.</p>
                <select className="settings-select" value={defaultView} onChange={(e) => { setDefaultView(e.target.value); markChanged(); }}>
                  {DEFAULT_VIEWS.map((v) => (<option key={v} value={v}>{v}</option>))}
                </select>
              </div>

              <div className="settings-card">
                <label className="settings-field-label">Startup Behavior</label>
                <div className="settings-toggle-row-group">
                  <div className="settings-toggle-row">
                    <div className="toggle-info"><span className="toggle-label">Open on system startup</span><span className="toggle-desc">Launch the app automatically when your system starts.</span></div>
                    <label className="toggle-switch"><input type="checkbox" checked={openOnStartup} onChange={(e) => { setOpenOnStartup(e.target.checked); markChanged(); }} /><span className="toggle-slider" /></label>
                  </div>
                  <div className="settings-toggle-row">
                    <div className="toggle-info"><span className="toggle-label">Start in background / minimized</span><span className="toggle-desc">App starts minimized to the system tray.</span></div>
                    <label className="toggle-switch"><input type="checkbox" checked={startMinimized} onChange={(e) => { setStartMinimized(e.target.checked); markChanged(); }} /><span className="toggle-slider" /></label>
                  </div>
                </div>
              </div>
            </section>

            {/* ─── ACCOUNT & PROFILE ─── */}
            <section id="settings-section-account" className="settings-section">
              <div className="settings-section-header"><SectionIcon icon="user" size={20} /><h3>Account & Profile</h3></div>
              <p className="settings-section-desc">Manage your personal information, email, and security.</p>

              <div className="settings-card">
                <label className="settings-field-label">Profile Details</label>
                <div className="profile-details-row">
                  <div className="avatar-section">
                    <div className="avatar-wrapper" onClick={() => avatarInputRef.current?.click()}>
                      {avatarUrl ? (<img src={avatarUrl} alt="Avatar" className="avatar-img" />) : (
                        <div className="avatar-placeholder"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg></div>
                      )}
                      <div className="avatar-overlay"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg><span>Change</span></div>
                      <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} />
                    </div>
                    {avatarUrl && (
                      <button className="avatar-remove-btn" onClick={(e) => { e.stopPropagation(); setAvatarUrl(null); markChanged(); }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="profile-fields">
                    <div className="settings-field">
                      <label className="settings-input-label">Username</label>
                      <input type="text" className="settings-input" value={username} onChange={(e) => { setUsername(e.target.value); markChanged(); }} placeholder="Your display name" />
                    </div>
                    <div className="settings-field">
                      <label className="settings-input-label">Bio <span className="char-count">{bio.length}/150</span></label>
                      <textarea className="settings-textarea" value={bio} onChange={(e) => { if (e.target.value.length <= 150) { setBio(e.target.value); markChanged(); } }} placeholder="Tell us a little about yourself..." rows={2} maxLength={150} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div className="settings-field">
                        <label className="settings-input-label">Country</label>
                        <input type="text" className="settings-input" value={country} onChange={(e) => { setCountry(e.target.value); markChanged(); }} placeholder="e.g. Philippines" />
                      </div>
                      <div className="settings-field">
                        <label className="settings-input-label">Status</label>
                        <input type="text" className="settings-input" value={status} onChange={(e) => { setStatus(e.target.value); markChanged(); }} placeholder="e.g. Working from home" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="settings-card">
                <label className="settings-field-label">Email Address</label>
                <div className="email-update-row">
                  <input type="email" className="settings-input" value={email} onChange={(e) => { setEmail(e.target.value); markChanged(); }} />
                  <button className="settings-btn-outline" onClick={() => showModal({ title: "Email Updated", message: `Your email has been updated to ${email}.`, type: "success" })}>Update Email</button>
                </div>
              </div>

              <div className="settings-card">
                <label className="settings-field-label">Password Management</label>
                <p className="settings-field-hint">Ensure your account remains secure by using a strong password.</p>
                <div className="password-fields">
                  <div className="settings-field"><label className="settings-input-label">Current Password</label><input type="password" className="settings-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" /></div>
                  <div className="password-new-row">
                    <div className="settings-field"><label className="settings-input-label">New Password</label><input type="password" className="settings-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 characters" /></div>
                    <div className="settings-field"><label className="settings-input-label">Confirm New Password</label><input type="password" className="settings-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" /></div>
                  </div>
                  <button className="settings-btn-primary" onClick={handleChangePassword}>Change Password</button>
                </div>
              </div>

              <div className="settings-card danger-zone">
                <label className="settings-field-label danger"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>Danger Zone</label>
                <p className="danger-text">Permanently delete your account or sign out of the current session.</p>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button className="settings-btn-danger" onClick={handleDeleteAccount}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>Delete Account</button>
                  <button 
                    className="settings-btn-outline" 
                    onClick={onLogout}
                    style={{ borderColor: "var(--color-logout)", color: "var(--color-logout)" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    LOGOUT
                  </button>
                </div>
              </div>
            </section>

            {/* ─── NOTIFICATIONS ─── */}
            <section id="settings-section-notifications" className="settings-section">
              <div className="settings-section-header"><SectionIcon icon="bell" size={20} /><h3>Notifications</h3></div>
              <p className="settings-section-desc">Control how and when you receive alerts.</p>

              <div className="settings-card notification-master">
                <div className="settings-toggle-row">
                  <div className="toggle-info"><span className="toggle-label master">Push / Desktop Notifications</span><span className="toggle-desc">Enable or disable all notifications globally.</span></div>
                  <label className="toggle-switch large"><input type="checkbox" checked={notificationsEnabled} onChange={(e) => { setNotificationsEnabled(e.target.checked); markChanged(); }} /><span className="toggle-slider" /></label>
                </div>
              </div>

              <div className={`settings-card ${!notificationsEnabled ? "disabled-card" : ""}`}>
                <label className="settings-field-label">Specific Triggers</label>
                <p className="settings-field-hint">Fine-tune which events send you a notification.</p>
                <div className="notification-checklist">
                  {[
                    { label: "Notify me on errors", desc: "Get alerted for critical system errors.", checked: notifyErrors, setter: setNotifyErrors, icon: "🔴" },
                    { label: "Notify me on updates", desc: "Stay informed about project and task updates.", checked: notifyUpdates, setter: setNotifyUpdates, icon: "🔵" },
                  ].map((item) => (
                    <label key={item.label} className={`notification-check-item ${item.checked ? "checked" : ""} ${!notificationsEnabled ? "disabled" : ""}`}>
                      <div className="notification-check-left"><span className="notification-check-icon">{item.icon}</span><div><span className="notification-check-label">{item.label}</span><span className="notification-check-desc">{item.desc}</span></div></div>
                      <input type="checkbox" checked={item.checked} disabled={!notificationsEnabled} onChange={(e) => { item.setter(e.target.checked); markChanged(); }} className="notification-checkbox" />
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* ─── STAFF MANAGEMENT (Admin+ only) ─── */}
            {isAdminPlus && (
              <section id="settings-section-staff" className="settings-section">
                <div className="settings-section-header"><SectionIcon icon="shield" size={20} /><h3>Staff Management</h3></div>
                <p className="settings-section-desc">Manage team members, approve access requests, and reset credentials.</p>

                {/* Pending Access Requests */}
                <div className="settings-card">
                  <label className="settings-field-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    Pending Access Requests
                    {pendingRequests.length > 0 && (
                      <span style={{ background: "var(--color-logout)", color: "white", borderRadius: "20px", padding: "2px 10px", fontSize: "0.7rem", fontWeight: 800, marginLeft: "4px" }}>{pendingRequests.length}</span>
                    )}
                  </label>
                  {pendingRequests.length > 0 ? (
                    <div className="staff-management-list">
                      {pendingRequests.map((s) => (
                        <div key={s.email} className="staff-mgmt-row pending">
                          <div className="staff-mgmt-avatar" onClick={() => onViewProfile && onViewProfile(s)}>
                            {s.avatarUrl ? <img src={s.avatarUrl} alt={s.name} /> : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                            )}
                          </div>
                          <div className="staff-mgmt-info">
                            <span className="staff-mgmt-name">{s.name}</span>
                            <span className="staff-mgmt-email">{s.email}</span>
                          </div>
                          <div className="staff-mgmt-actions">
                            <button
                              className="staff-action-btn approve"
                              onClick={async () => {
                                try {
                                  await updateStaffRole({ staffEmail: s.email, newRole: "Programmer" });
                                  showModal({ title: "Approved", message: `${s.name} has been approved as Programmer.`, type: "success" });
                                } catch (err) {
                                  showModal({ title: "Error", message: err.message, type: "alert" });
                                }
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                              Approve
                            </button>
                            <button
                              className="staff-action-btn reject"
                              onClick={async () => {
                                try {
                                  await deleteStaffMut({ email: s.email });
                                  showModal({ title: "Rejected", message: `Access for ${s.name} has been rejected.`, type: "success" });
                                } catch (err) {
                                  showModal({ title: "Error", message: err.message, type: "alert" });
                                }
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", color: "var(--color-text-secondary)", fontStyle: "italic", padding: "24px", background: "var(--color-bg-subtle)", borderRadius: "var(--radius-md)", border: "1px dashed var(--glass-border)", fontSize: "0.85rem" }}>
                      No pending access requests.
                    </div>
                  )}
                </div>

                {/* Active Staff */}
                <div className="settings-card">
                  <label className="settings-field-label">Active Team Members</label>
                  <p className="settings-field-hint">Manage roles, reset passwords, or revoke access for current team members.</p>
                  <div className="staff-management-list">
                    {activeStaff.map((s) => (
                      <div key={s.email} className="staff-mgmt-row">
                        <div className="staff-mgmt-avatar" onClick={() => onViewProfile && onViewProfile(s)} style={{ cursor: "pointer" }}>
                          {s.avatarUrl ? <img src={s.avatarUrl} alt={s.name} /> : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                          )}
                        </div>
                        <div className="staff-mgmt-info">
                          <span className="staff-mgmt-name" onClick={() => onViewProfile && onViewProfile(s)} style={{ cursor: "pointer" }}>{s.name}</span>
                          <span className="staff-mgmt-email">{s.email}</span>
                        </div>
                        <div className="staff-mgmt-role">
                          <select
                            className="staff-role-select"
                            value={s.role}
                            onChange={async (e) => {
                              const newRole = e.target.value;
                              await updateStaffRole({ staffEmail: s.email, newRole });
                              showModal({ title: "Role Updated", message: `${s.name}'s role has been changed to ${newRole}.`, type: "success" });
                            }}
                          >
                            <option value="Programmer">Programmer</option>
                            <option value="Admin">Admin</option>
                            <option value="Admin+">Admin+</option>
                          </select>
                        </div>
                        <div className="staff-mgmt-actions">
                          <button
                            className="staff-action-btn reset-pw"
                            title="Reset password — user will need to set a new one on next login"
                            onClick={() => {
                              showModal({
                                title: "Reset Password",
                                message: `Are you sure you want to reset the password for ${s.name}? They will need to set a new password on their next login using the default password.`,
                                type: "confirm",
                                onConfirm: async () => {
                                  try {
                                    await resetPasswordMut({ targetEmail: s.email });
                                    showModal({ title: "Password Reset", message: `Password for ${s.name} has been reset successfully.`, type: "success" });
                                  } catch (err) {
                                    showModal({ title: "Error", message: err.message, type: "alert" });
                                  }
                                },
                              });
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                            Reset PW
                          </button>
                          <button
                            className="staff-action-btn revoke"
                            title="Revoke this user's access"
                            onClick={() => {
                              showModal({
                                title: "Revoke Access",
                                message: `Are you sure you want to revoke access for ${s.name}? They will no longer be able to log in.`,
                                type: "confirm",
                                onConfirm: async () => {
                                  try {
                                    await deleteStaffMut({ email: s.email });
                                    showModal({ title: "Access Revoked", message: `Successfully removed access for ${s.name}.`, type: "success" });
                                  } catch (err) {
                                    showModal({ title: "Error", message: err.message, type: "alert" });
                                  }
                                },
                              });
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                            Revoke
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add New Staff */}
                <div className="settings-card">
                  <label className="settings-field-label">Add New Staff Member</label>
                  <p className="settings-field-hint">Register a new team member with their email and assigned role.</p>
                  <div className="add-staff-form">
                    <div className="settings-field">
                      <label className="settings-input-label">Full Name</label>
                      <input type="text" className="settings-input" value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder="e.g. John Doe" />
                    </div>
                    <div className="settings-field">
                      <label className="settings-input-label">Email Address</label>
                      <input type="email" className="settings-input" value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} placeholder="e.g. jdoe@company.com" />
                    </div>
                    <div className="settings-field">
                      <label className="settings-input-label">Role</label>
                      <select className="settings-select" value={newStaffRole} onChange={(e) => setNewStaffRole(e.target.value)}>
                        <option value="Programmer">Programmer</option>
                        <option value="Admin">Admin</option>
                        <option value="Admin+">Admin+</option>
                      </select>
                    </div>
                    <button
                      className="settings-btn-primary"
                      style={{ marginTop: "8px" }}
                      onClick={async () => {
                        if (!newStaffName.trim() || !newStaffEmail.trim()) {
                          showModal({ title: "Error", message: "Please fill in both name and email.", type: "alert" });
                          return;
                        }
                        try {
                          await addStaffMut({ name: newStaffName.trim(), email: newStaffEmail.trim(), role: newStaffRole });
                          showModal({ title: "Staff Added", message: `${newStaffName} has been registered successfully.`, type: "success" });
                          setNewStaffName("");
                          setNewStaffEmail("");
                          setNewStaffRole("Programmer");
                        } catch (err) {
                          showModal({ title: "Error", message: err.message, type: "alert" });
                        }
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      Register Staff Member
                    </button>
                  </div>
                </div>
              </section>
            )}

            <div style={{ height: 100 }} />
          </div>
        </div>

        {/* Sticky Footer */}
        <div className={`settings-footer ${hasChanges ? "show" : ""}`}>
          <span className="settings-footer-hint">You have unsaved changes</span>
          <div className="settings-footer-actions">
            <button className="settings-btn-ghost" onClick={handleCancel}>Cancel</button>
            <button className="settings-btn-save" onClick={handleSave}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}
