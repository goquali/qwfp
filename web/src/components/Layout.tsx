import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { get, setCurrentUser } from "../api/client";
import type { User } from "../api/types";

export default function Layout() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Bootstrap: set a temporary admin user so we can fetch the user list
    setCurrentUser({ id: "bootstrap", role: "admin", name: "Bootstrap" });
    get<User[]>("/users").then((data) => {
      setUsers(data);
      // Default to admin user (Alex) for Executive overview
      const defaultUser = data.find(u => u.role === "admin") || data.find(u => u.role === "finance") || data[0];
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
      // Force re-render of child routes
      window.location.reload();
    }
  }

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-brand">QWFP</div>

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
        {ready ? <Outlet /> : <div className="loading">Loading...</div>}
      </main>
    </div>
  );
}
