import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Login({ onLogin, externalError = "", onResetSuccess }) {
  const [mode, setMode] = useState("login"); // "login", "forgot", "verify"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const requestResetAction = useAction(api.staff.requestPasswordReset);
  const verifyPinMut = useMutation(api.staff.verifyResetPin);

  const displayError = externalError || error;

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter a password.");
      return;
    }
    onLogin(email.trim().toLowerCase(), password);
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setIsLoading(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await requestResetAction({ email: email.trim().toLowerCase() });
      if (res.success) {
        setSuccessMsg("A 6-digit reset PIN has been sent to your email.");
        setMode("verify");
      } else {
        throw new Error(res.message || "Failed to send reset email.");
      }
    } catch (err) {
      setError(err.message || "Failed to request password reset.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyPin = async (e) => {
    e.preventDefault();
    if (pin.trim().length !== 6) {
      setError("Please enter the 6-digit PIN.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await verifyPinMut({ email: email.trim().toLowerCase(), pin: pin.trim() });
      if (res.success) {
        // Pass control to App.jsx to drop user into the set-password flow
        if (onResetSuccess) {
          onResetSuccess(email.trim().toLowerCase());
        }
      }
    } catch (err) {
      setError(err.message || "Invalid or expired PIN.");
    } finally {
      setIsLoading(false);
    }
  };

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
      <div className="login-box">
        {mode === "login" && (
          <>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4355f1" strokeWidth="2" style={{ marginBottom: 20 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <h2 style={{ color: "#1e293b", marginBottom: 10, fontWeight: 900 }}>System Login</h2>
            <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: 25 }}>
              Enter your email and password to continue.
            </p>

            <form onSubmit={handleLoginSubmit} style={{ width: "100%" }}>
              <div className="form-group" style={{ marginBottom: "15px" }}>
                <input
                  type="email"
                  className="form-input"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ marginBottom: "8px" }}>
                <input
                  type="password"
                  className={`form-input ${error ? "input-error" : ""}`}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  required
                />
                {displayError && <div className="error-text">{displayError}</div>}
              </div>
              <div style={{ textAlign: "right", marginBottom: "20px" }}>
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "var(--color-accent)", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", padding: 0 }}
                  onClick={() => { setMode("forgot"); setError(""); setPassword(""); }}
                >
                  Forgot Password?
                </button>
              </div>
              <button type="submit" className="btn-primary" style={{ width: "100%" }}>
                Secure Access
              </button>
            </form>
          </>
        )}

        {mode === "forgot" && (
          <>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4355f1" strokeWidth="2" style={{ marginBottom: 20 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <h2 style={{ color: "#1e293b", marginBottom: 10, fontWeight: 900 }}>Reset Password</h2>
            <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: 25 }}>
              Enter your email to receive a 6-digit reset PIN.
            </p>

            <form onSubmit={handleRequestReset} style={{ width: "100%" }}>
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <input
                  type="email"
                  className={`form-input ${error ? "input-error" : ""}`}
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  required
                  autoFocus
                />
                {error && <div className="error-text">{error}</div>}
              </div>
              <button type="submit" className="btn-primary" style={{ width: "100%", marginBottom: "15px" }} disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset PIN"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: "100%" }}
                onClick={() => { setMode("login"); setError(""); }}
              >
                Back to Login
              </button>
            </form>
          </>
        )}

        {mode === "verify" && (
          <>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" style={{ marginBottom: 20 }}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <h2 style={{ color: "#1e293b", marginBottom: 10, fontWeight: 900 }}>Verify PIN</h2>
            <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: 20 }}>
              Enter the 6-digit PIN sent to <strong>{email}</strong>.
            </p>
            {successMsg && <p style={{ color: "#10b981", fontSize: "0.85rem", marginBottom: 20, fontWeight: 600 }}>{successMsg}</p>}

            <form onSubmit={handleVerifyPin} style={{ width: "100%" }}>
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <input
                  type="text"
                  className={`form-input ${error ? "input-error" : ""}`}
                  placeholder="6-digit PIN"
                  value={pin}
                  onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                  style={{ textAlign: "center", fontSize: "1.2rem", letterSpacing: "4px", fontWeight: 800 }}
                  required
                  autoFocus
                />
                {error && <div className="error-text">{error}</div>}
              </div>
              <button type="submit" className="btn-primary" style={{ width: "100%", marginBottom: "15px" }} disabled={isLoading || pin.length !== 6}>
                {isLoading ? "Verifying..." : "Verify & Reset"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: "100%" }}
                onClick={() => { setMode("forgot"); setError(""); setSuccessMsg(""); setPin(""); }}
              >
                Go Back
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
