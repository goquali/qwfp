import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { get, setCurrentUser } from "../api/client";
import type { User } from "../api/types";
import AICopilot from "./AICopilot";

export default function Layout() {
  const [ready, setReady] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setCurrentUser({ id: "bootstrap", role: "admin", name: "Bootstrap" });
    get<User[]>("/users").then((data) => {
      const admin = data.find(u => u.role === "admin") || data[0];
      if (admin) {
        setCurrentUser({ id: admin.id, role: admin.role, name: admin.name });
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  return (
    <>
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <header className="top-header">
          <div className="header-left">
            <NavLink to="/" style={{ textDecoration: "none" }}>
              <span className="brand-logo">QWFP</span>
            </NavLink>

            <button
              className="mobile-menu-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? "✕" : "☰"}
            </button>

            <nav className={`top-nav ${menuOpen ? "open" : ""}`}>
              <TopNavLink to="/" end label="Demo" onClick={() => setMenuOpen(false)} />
              <TopNavLink to="/dashboard" label="Dashboard" onClick={() => setMenuOpen(false)} />
              <TopNavLink to="/onboarding" label="Get Started" onClick={() => setMenuOpen(false)} />
              <TopNavLink to="/pricing" label="Pricing" onClick={() => setMenuOpen(false)} />
              <TopNavLink to="/how-it-works" label="How It Works" onClick={() => setMenuOpen(false)} />
              <TopNavLink to="/admin" label="Admin" onClick={() => setMenuOpen(false)} />
            </nav>
          </div>

          <button
            onClick={() => setCopilotOpen(!copilotOpen)}
            title="AI Copilot"
            className="ask-ai-btn"
            style={{
              background: copilotOpen ? "#232A23" : "transparent",
              color: copilotOpen ? "#fff" : "#616D61",
            }}
          >
            <span>✨</span> Ask AI
          </button>
        </header>

        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>
          {ready ? <Outlet /> : <div className="loading">Loading...</div>}
        </main>
      </div>

      <AICopilot open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </>
  );
}

function TopNavLink({ to, label, end, onClick }: { to: string; label: string; end?: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) => `top-nav-link ${isActive ? "active" : ""}`}
    >
      {label}
    </NavLink>
  );
}
