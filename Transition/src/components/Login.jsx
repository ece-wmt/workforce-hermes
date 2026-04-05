import { useState } from "react";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    
    if (password === "admin") {
      onLogin(email.trim());
    } else {
      setError("Incorrect password.");
      setPassword("");
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
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4355f1" strokeWidth="2" style={{ marginBottom: 20 }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
        <h2 style={{ color: "#1e293b", marginBottom: 10, fontWeight: 900 }}>System Login</h2>
        <p style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: 25 }}>
          Enter the access password to continue.
        </p>

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <div className="form-group" style={{ marginBottom: "15px" }}>
            <input
              type="email"
              className={`form-input`}
              placeholder="Enter your email address..."
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(false);
              }}
              required
              autoFocus
            />
          </div>
          <div className="form-group" style={{ marginBottom: "20px" }}>
            <input
              type="password"
              className={`form-input ${error ? "input-error" : ""}`}
              placeholder="Enter system password (admin)..."
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              required
            />
            {error && <div className="error-text">{error}</div>}
          </div>
          <button type="submit" className="btn-primary" style={{ width: "100%" }}>
            Secure Access
          </button>
        </form>
      </div>
    </div>
  );
}
