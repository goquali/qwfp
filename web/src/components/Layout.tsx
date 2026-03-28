import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { get, setCurrentUser } from "../api/client";
import type { User } from "../api/types";

export default function Layout() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  useEffect(() => {
    // Bootstrap: set a temporary admin user so we can fetch the user list
    setCurrentUser({ id: "bootstrap", role: "admin", name: "Bootstrap" });
    get<User[]>("/users").then((data) => {
      setUsers(data);
      // Default to finance user (Sarah)
      const finance = data.find(u => u.role === "finance");
      if (finance) {
        setSelectedUserId(finance.id);
        setCurrentUser({ id: finance.id, role: finance.role, name: finance.name });
      }
    });
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

        {/* Finance links - visible to finance and admin */}
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

        {/* Admin sees all */}
        {role === "admin" && (
          <>
            <div className="sidebar-section">Admin</div>
            <NavLink to="/finance" className={({isActive}) => `sidebar-link ${isActive ? "active" : ""}`}>All Dashboards</NavLink>
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
        <Outlet />
      </main>
    </div>
  );
}
