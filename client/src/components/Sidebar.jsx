import React from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar() {
    const navItems = [
        {
            to: "/dashboard",
            label: "Dashboard",
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                </svg>
            ),
        },
        {
            to: "/documents",
            label: "Mis documentos",
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                </svg>
            ),
        },
        {
            to: "/team",
            label: "Mi equipo",
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            ),
        },
    ];

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
