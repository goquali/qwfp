import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { get, setCurrentUser } from "../api/client";
import type { User } from "../api/types";
import AICopilot from "./AICopilot";

export default function Layout() {
  const [ready, setReady] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

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
        {/* Top Navigation Bar */}
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          height: 52,
          background: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 50,
          boxShadow: "0 1px 0 var(--border)",
        }}>
          {/* Left: Brand + Nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <NavLink to="/" style={{ textDecoration: "none" }}>
              <span style={{
                fontSize: 24,
                fontFamily: "var(--font-body)",
                fontWeight: 700,
                color: "#1A1D1A",
                letterSpacing: -0.5,
              }}>QWFP</span>
            </NavLink>

            <nav style={{ display: "flex", gap: 4 }}>
              <TopNavLink to="/" end label="Demo" />
              <TopNavLink to="/dashboard" label="Dashboard" />
              <TopNavLink to="/onboarding" label="Get Started" />
              <TopNavLink to="/pricing" label="Pricing" />
              <TopNavLink to="/how-it-works" label="How It Works" />
              <TopNavLink to="/admin" label="Admin" />
            </nav>
          </div>

          {/* Right: AI Copilot button */}
          <button
            onClick={() => setCopilotOpen(!copilotOpen)}
            title="AI Copilot"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 4,
              border: "1px solid #E4E7E4",
              background: copilotOpen ? "#232A23" : "transparent",
              color: copilotOpen ? "#fff" : "#616D61",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "var(--font-body)",
              transition: "all 0.2s",
            }}
          >
            <span>✨</span> Ask AI
          </button>
        </header>

        {/* Main Content */}
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 32px" }}>
          {ready ? <Outlet /> : <div className="loading">Loading...</div>}
        </main>
      </div>

      <AICopilot open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </>
  );
}

function TopNavLink({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive }) => ({
        padding: "6px 14px",
        borderRadius: 4,
        fontSize: 14,
        fontWeight: isActive ? 600 : 500,
        textDecoration: "none",
        color: isActive ? "#22A652" : "var(--text-secondary)",
        background: isActive ? "rgba(34,166,82,0.08)" : "transparent",
        borderBottom: "2px solid transparent",
        transition: "all 0.2s",
      })}
    >
      {label}
    </NavLink>
  );
}
