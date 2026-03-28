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
          height: 56,
          borderBottom: "1px solid var(--border)",
          background: "#fff",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}>
          {/* Left: Brand + Nav */}
          <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <NavLink to="/" style={{ textDecoration: "none" }}>
              <span style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: -0.5,
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>QWFP</span>
            </NavLink>

            <nav style={{ display: "flex", gap: 4 }}>
              <TopNavLink to="/" end label="Demo" />
              <TopNavLink to="/dashboard" label="Dashboard" />
              <TopNavLink to="/how-it-works" label="How It Works" />
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
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: copilotOpen ? "var(--primary)" : "#fff",
              color: copilotOpen ? "#fff" : "var(--text-secondary, #5e6278)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "inherit",
              transition: "all 0.15s",
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
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        textDecoration: "none",
        color: isActive ? "var(--primary, #6366f1)" : "var(--text-secondary, #5e6278)",
        background: isActive ? "rgba(99, 102, 241, 0.08)" : "transparent",
        transition: "all 0.15s",
      })}
    >
      {label}
    </NavLink>
  );
}
