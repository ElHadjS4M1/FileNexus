import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Icons
const DashboardIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
    </svg>
);

const DocumentsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
);

const TeamIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const UsersIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const BuildingIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <path d="M9 22V12h6v10" />
        <line x1="9" y1="6" x2="9" y2="6.01" />
        <line x1="15" y1="6" x2="15" y2="6.01" />
        <line x1="9" y1="10" x2="9" y2="10.01" />
        <line x1="15" y1="10" x2="15" y2="10.01" />
    </svg>
);

export default function Sidebar() {
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";
    const isDeptHead = user?.role === "dept_head";

    // Base items for all users
    const baseItems = [
        { to: "/dashboard", label: "Dashboard", icon: <DashboardIcon /> },
    ];

    // Admin-specific items
    const adminItems = [
        { to: "/users", label: "Usuarios", icon: <UsersIcon /> },
        { to: "/team", label: "Departamentos", icon: <BuildingIcon /> },
    ];

    // Dept head items
    const deptHeadItems = [
        { to: "/documents", label: "Mis documentos", icon: <DocumentsIcon /> },
        { to: "/team", label: "Proyectos", icon: <BuildingIcon /> },
    ];

    // Regular user items
    const userItems = [
        { to: "/documents", label: "Mis documentos", icon: <DocumentsIcon /> },
        { to: "/team", label: "Mi equipo", icon: <TeamIcon /> },
    ];

    let roleItems = userItems;
    if (isAdmin) roleItems = adminItems;
    else if (isDeptHead) roleItems = deptHeadItems;

    const navItems = [...baseItems, ...roleItems];

    return (
        <aside style={{
            width: "240px",
            minHeight: "calc(100vh - 56px)",
            background: "white",
            borderRight: "1px solid #e5e5e5",
            padding: "16px 0"
        }}>
            <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        style={({ isActive }) => ({
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "12px 20px",
                            margin: "0 12px",
                            borderRadius: "8px",
                            textDecoration: "none",
                            fontSize: "14px",
                            fontWeight: "500",
                            color: isActive ? "#0a6ed1" : "#555",
                            background: isActive ? "rgba(10, 110, 209, 0.08)" : "transparent",
                            transition: "all 0.15s ease"
                        })}
                    >
                        <span style={{ display: "flex", alignItems: "center" }}>
                            {item.icon}
                        </span>
                        {item.label}
                    </NavLink>
                ))}
            </nav>
        </aside>
    );
}
