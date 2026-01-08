import React from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

export default function Layout() {
    const { user } = useAuth();

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
