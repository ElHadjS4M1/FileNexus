import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const handleLogout = async () => {
        await logout();
        navigate("/");
    };

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!user) return null;

    const userInitial = user.username.charAt(0).toUpperCase();

    return (
        <header style={{
            background: "linear-gradient(135deg, #354a5f 0%, #2c3e50 100%)",
            height: "56px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)"
        }}>
            {/* Logo */}
            <Link to="/dashboard" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
                <div style={{
                    width: "36px",
                    height: "36px",
                    background: "linear-gradient(135deg, #0a6ed1 0%, #0854a0 100%)",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                        <path d="M9 12l2 2 4-4" />
                    </svg>
                </div>
                <span style={{
                    color: "white",
                    fontSize: "18px",
                    fontWeight: "600",
                    letterSpacing: "-0.3px"
                }}>
                    ProtectInfo
                </span>
            </Link>

            {/* Menú de usuario */}
            <div ref={dropdownRef} style={{ position: "relative" }}>
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: "8px",
                        padding: "6px 14px 6px 8px",
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                    }}
                    onMouseEnter={(e) => e.target.style.background = "rgba(255,255,255,0.15)"}
                    onMouseLeave={(e) => e.target.style.background = "rgba(255,255,255,0.1)"}
                >
                    <div style={{
                        width: "32px",
                        height: "32px",
                        background: "linear-gradient(135deg, #0a6ed1 0%, #1a85e0 100%)",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "14px",
                        fontWeight: "600"
                    }}>
                        {userInitial}
                    </div>
                    <span style={{ color: "white", fontSize: "14px", fontWeight: "500" }}>
                        {user.username}
                    </span>
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="rgba(255,255,255,0.8)"
                        strokeWidth="2"
                        style={{
                            transition: "transform 0.2s ease",
                            transform: isOpen ? "rotate(180deg)" : "rotate(0)"
                        }}
                    >
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </button>

                {/* Desplegable */}
                {isOpen && (
                    <div style={{
                        position: "absolute",
                        top: "calc(100% + 8px)",
                        right: "0",
                        width: "220px",
                        background: "white",
                        borderRadius: "8px",
                        boxShadow: "0 10px 40px rgba(0,0,0,0.15), 0 2px 10px rgba(0,0,0,0.1)",
                        overflow: "hidden",
                        zIndex: 1000,
                        animation: "slideDown 0.15s ease-out"
                    }}>
                        {/* Encabezado de información de usuario */}
                        <div style={{
                            padding: "16px",
                            borderBottom: "1px solid #e5e5e5",
                            background: "#fafafa"
                        }}>
                            <div style={{ fontSize: "14px", fontWeight: "600", color: "#333" }}>
                                {user.username}
                            </div>
                            <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                                {user.role === "admin" ? "Administrador" : "Usuario"}
                            </div>
                        </div>

                        {/* Elementos del menú */}
                        <div style={{ padding: "8px 0" }}>
                            <Link
                                to="/settings"
                                onClick={() => setIsOpen(false)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                    padding: "12px 16px",
                                    color: "#333",
                                    textDecoration: "none",
                                    fontSize: "14px",
                                    transition: "background 0.15s ease"
                                }}
                                onMouseEnter={(e) => e.target.style.background = "#f5f5f5"}
                                onMouseLeave={(e) => e.target.style.background = "transparent"}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                </svg>
                                Ajustes
                            </Link>

                            <div style={{ height: "1px", background: "#e5e5e5", margin: "4px 16px" }}></div>

                            <button
                                onClick={handleLogout}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                    padding: "12px 16px",
                                    width: "100%",
                                    background: "transparent",
                                    border: "none",
                                    color: "#c0392b",
                                    fontSize: "14px",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    transition: "background 0.15s ease"
                                }}
                                onMouseEnter={(e) => e.target.style.background = "#fef5f5"}
                                onMouseLeave={(e) => e.target.style.background = "transparent"}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                                Cerrar sesión
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </header>
    );
}
