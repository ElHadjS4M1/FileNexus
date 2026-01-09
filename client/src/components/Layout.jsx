import React, { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

function UnlockScreen() {
    const { sessionUser, unlockWithPassword, logout } = useAuth();
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleUnlock = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await unlockWithPassword(password);
        } catch (err) {
            setError(err.message || "Contraseña incorrecta");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        }}>
            <div style={{
                background: "white",
                borderRadius: "16px",
                padding: "48px",
                maxWidth: "420px",
                width: "90%",
                textAlign: "center",
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
            }}>
                <div style={{
                    width: "80px",
                    height: "80px",
                    background: "linear-gradient(135deg, #0a6ed1 0%, #0856a8 100%)",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 24px"
                }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                </div>

                <h2 style={{ fontSize: "24px", fontWeight: "600", color: "#1a1a1a", marginBottom: "8px" }}>
                    Sesión bloqueada
                </h2>
                <p style={{ fontSize: "14px", color: "#666", marginBottom: "32px" }}>
                    Bienvenido de nuevo, <strong>{sessionUser?.username}</strong>.<br />
                    Introduce tu contraseña para desbloquear.
                </p>

                <form onSubmit={handleUnlock}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Contraseña"
                        autoFocus
                        style={{
                            width: "100%",
                            padding: "14px 16px",
                            border: "2px solid #e0e0e0",
                            borderRadius: "8px",
                            fontSize: "16px",
                            marginBottom: "16px",
                            boxSizing: "border-box"
                        }}
                    />

                    {error && (
                        <p style={{ color: "#dc2626", fontSize: "14px", marginBottom: "16px" }}>
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !password}
                        style={{
                            width: "100%",
                            padding: "14px",
                            background: loading ? "#93c5fd" : "#0a6ed1",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "16px",
                            fontWeight: "600",
                            cursor: loading ? "not-allowed" : "pointer",
                            marginBottom: "16px"
                        }}
                    >
                        {loading ? "Desbloqueando..." : "Desbloquear"}
                    </button>
                </form>

                <button
                    onClick={handleLogout}
                    style={{
                        background: "none",
                        border: "none",
                        color: "#666",
                        fontSize: "14px",
                        cursor: "pointer",
                        textDecoration: "underline"
                    }}
                >
                    Iniciar sesión con otra cuenta
                </button>
            </div>
        </div>
    );
}

export default function Layout() {
    const { user, sessionUser, loading } = useAuth();

    // Still checking session
    if (loading) {
        return (
            <div style={{
                minHeight: "100vh",
                background: "linear-gradient(135deg, #f0f4f8 0%, #e8eef5 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{
                        width: "48px",
                        height: "48px",
                        border: "4px solid #e0e0e0",
                        borderTopColor: "#0a6ed1",
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                        margin: "0 auto 16px"
                    }} />
                    <p style={{ color: "#666" }}>Cargando...</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // Session exists but keys not unlocked - show unlock screen
    if (sessionUser && !user) {
        return <UnlockScreen />;
    }

    // Not logged in at all
    if (!user) {
        return <Navigate to="/" replace />;
    }

    return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #f0f4f8 0%, #e8eef5 100%)" }}>
            <Navbar />
            <div style={{ display: "flex" }}>
                <Sidebar />
                <main style={{ flex: 1, overflow: "auto" }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
