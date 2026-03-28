import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { get, setCurrentUser } from "../api/client";
import type { User } from "../api/types";
import AICopilot from "./AICopilot";

export default function Layout() {
  const [ready, setReady] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  useEffect(() => {
    // Bootstrap with admin user for full access
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
      <div className="app-layout">
        <nav className="sidebar">
          <div className="sidebar-brand">QWFP</div>

          <NavLink to="/" end className={({isActive}) => `sidebar-link ${isActive ? "active" : ""}`}>
            Demo
          </NavLink>
          <NavLink to="/dashboard" className={({isActive}) => `sidebar-link ${isActive ? "active" : ""}`}>
            Dashboard
          </NavLink>
          <NavLink to="/how-it-works" className={({isActive}) => `sidebar-link ${isActive ? "active" : ""}`}>
            How It Works
          </NavLink>
        </nav>

        <main className="main-content">
          {ready ? <Outlet /> : <div className="loading">Loading...</div>}
        </main>
      </div>
      <button className="copilot-trigger" onClick={() => setCopilotOpen(!copilotOpen)} title="AI Copilot">
        ✨
      </button>
      <AICopilot open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </>
  );
}
