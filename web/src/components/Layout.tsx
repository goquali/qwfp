import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { get, setCurrentUser } from "../api/client";
import type { User } from "../api/types";

const ROLE_HOME: Record<string, string> = {
  admin: "/executive",
  finance: "/finance",
  hr: "/hr",
  business_owner: "/team",
  ta: "/ta",
};

export default function Layout() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [ready, setReady] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    setCurrentUser({ id: "bootstrap", role: "admin", name: "Bootstrap" });
    get<User[]>("/users").then((data) => {
      setUsers(data);
      // Check localStorage for previously selected user
      const savedId = localStorage.getItem("qwfp-user-id");
      const savedUser = savedId ? data.find(u => u.id === savedId) : null;
      const defaultUser = savedUser || data.find(u => u.role === "admin") || data.find(u => u.role === "finance") || data[0];
      if (defaultUser) {
        setSelectedUserId(defaultUser.id);
        setCurrentUser({ id: defaultUser.id, role: defaultUser.role, name: defaultUser.name });
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  const selectedUser = users.find(u => u.id === selectedUserId);
  const role = selectedUser?.role || "admin";

  function handleUserChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const user = users.find(u => u.id === e.target.value);
    if (user) {
      setSelectedUserId(user.id);
      setCurrentUser({ id: user.id, role: user.role, name: user.name });
      localStorage.setItem("qwfp-user-id", user.id);
      // Navigate to the role's home page and refresh data
      navigate(ROLE_HOME[user.role] || "/executive");
      setRefreshKey(k => k + 1);
    }
  }

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-brand">QWFP</div>

        <NavLink to="/how-it-works" className={({isActive}) => `sidebar-link ${isActive ? "active" : ""}`} style={{ fontSize: 13, opacity: 0.7 }}>
          How It Works
        </NavLink>

        {/* Executive — visible to admin and finance */}
        {(role === "admin" || role === "finance") && (
          <>
            <div className="sidebar-section">Executive</div>
            <NavLink to="/executive" className={({isActive}) => `sidebar-link ${isActive ? "active" : ""}`}>
              Company Overview
            </NavLink>
          </>
        )}

        {/* Finance links */}
        {(role === "finance" || role === "admin") && (
          <>
            <div className="sidebar-section">Finance</div>
            <NavLink to="/finance" className={({isActive}) => `sidebar-link ${isActive ? "active" : ""}`}>
              Budget Overview
            </NavLink>
          </>
        )}

        {/* HR links */}
        {(role === "hr" || role === "admin") && (
          <>
            <div className="sidebar-section">HR</div>
            <NavLink to="/hr" className={({isActive}) => `sidebar-link ${isActive ? "active" : ""}`}>
              Orchestration
            </NavLink>
          </>
        )}

        {/* Business Owner links */}
        {(role === "business_owner" || role === "admin") && (
          <>
            <div className="sidebar-section">Team</div>
            <NavLink to="/team" className={({isActive}) => `sidebar-link ${isActive ? "active" : ""}`}>
              Capacity Canvas
            </NavLink>
          </>
        )}

        {/* TA links */}
        {(role === "ta" || role === "admin") && (
          <>
            <div className="sidebar-section">Recruiting</div>
            <NavLink to="/ta" className={({isActive}) => `sidebar-link ${isActive ? "active" : ""}`}>
              TA Capacity
            </NavLink>
          </>
        )}

        <div className="persona-switcher">
          <label>Logged in as</label>
          <select value={selectedUserId} onChange={handleUserChange}>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>
      </nav>

      <main className="main-content">
        {ready ? <Outlet key={refreshKey} /> : <div className="loading">Loading...</div>}
      </main>
    </div>
  );
}
