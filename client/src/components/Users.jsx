import React, { useState, useEffect, useCallback, useMemo } from "react";
import { API_BASE } from "../api/auth.api";

const ITEMS_PER_PAGE = 10;

export default function Users() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    // Filtros
    const [searchQuery, setSearchQuery] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [currentPage, setCurrentPage] = useState(1);

    // Formulario de creación de usuario
    const [showCreate, setShowCreate] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [newPassword, setNewPassword] = useState("TempPass123!");
    const [newRole, setNewRole] = useState("user");

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/admin/users`, { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users || []);
            }
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Filtrar y paginar usuarios
    const filteredUsers = useMemo(() => {
        return users
            .filter(u => {
                const matchesSearch = !searchQuery || u.username.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesRole = !roleFilter || u.role === roleFilter;
                const matchesStatus = !statusFilter || u.status === statusFilter;
                return matchesSearch && matchesRole && matchesStatus;
            })
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }, [users, searchQuery, roleFilter, statusFilter]);

    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
    const paginatedUsers = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredUsers, currentPage]);

    // Reiniciar página cuando cambian los filtros
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, roleFilter, statusFilter]);

    const handleCreateUser = async () => {
        if (!newUsername || !newPassword) return;
        try {
            const res = await fetch(`${API_BASE}/admin/users`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: newUsername,
                    password: newPassword,
                    role: newRole,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Error al crear usuario");
            }
            setShowCreate(false);
            setNewUsername("");
            setNewPassword("");
            setNewRole("user");
            fetchUsers();
            setMessage("Usuario creado correctamente");
        } catch (error) {
            setMessage(error.message);
        }
    };

    const roleColors = {
        admin: { bg: "#fee2e2", color: "#dc2626" },
        dept_head: { bg: "#fef3c7", color: "#d97706" },
        project_head: { bg: "#dbeafe", color: "#2563eb" },
        user: { bg: "#e5e7eb", color: "#374151" },
    };

    return (
        <div style={{ padding: "40px" }}>
            <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                    <h1 style={{ fontSize: "28px", fontWeight: "700" }}>Gestión de Usuarios</h1>
                    <button
                        onClick={() => setShowCreate(true)}
                        style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 20px", background: "#0a6ed1", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "500" }}
                    >
                        + Nuevo Usuario
                    </button>
                </div>

                {message && (
                    <div style={{ padding: "12px 16px", background: "#ecfdf5", border: "1px solid #10b981", borderRadius: "8px", marginBottom: "16px", color: "#065f46" }}>
                        {message}
                        <button onClick={() => setMessage("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>×</button>
                    </div>
                )}

                {/* Filtros */}
                <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
                    <input
                        type="text"
                        placeholder="Buscar por nombre..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ flex: "1", padding: "10px 14px", border: "1px solid #ddd", borderRadius: "8px", fontSize: "14px" }}
                    />
                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        style={{ padding: "10px 14px", border: "1px solid #ddd", borderRadius: "8px", fontSize: "14px", width: "160px" }}
                    >
                        <option value="">Todos los roles</option>
                        <option value="admin">admin</option>
                        <option value="dept_head">dept_head</option>
                        <option value="project_head">project_head</option>
                        <option value="user">user</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        style={{ padding: "10px 14px", border: "1px solid #ddd", borderRadius: "8px", fontSize: "14px", width: "160px" }}
                    >
                        <option value="">Todos los estados</option>
                        <option value="active">active</option>
                        <option value="pending_init">pending_init</option>
                    </select>
                </div>

                <div style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                    {loading ? (
                        <p style={{ padding: "24px", color: "#999" }}>Cargando...</p>
                    ) : paginatedUsers.length === 0 ? (
                        <p style={{ padding: "24px", color: "#999" }}>No se encontraron usuarios.</p>
                    ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e5e5" }}>
                                    <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Usuario</th>
                                    <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Rol</th>
                                    <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Estado</th>
                                    <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: "600", color: "#374151" }}>Fecha creación</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedUsers.map(u => (
                                    <tr key={u.id} style={{ borderBottom: "1px solid #e5e5e5" }}>
                                        <td style={{ padding: "14px 16px", fontWeight: "500" }}>{u.username}</td>
                                        <td style={{ padding: "14px 16px" }}>
                                            <span style={{
                                                padding: "4px 10px",
                                                borderRadius: "12px",
                                                fontSize: "12px",
                                                fontWeight: "500",
                                                background: roleColors[u.role]?.bg || "#e5e7eb",
                                                color: roleColors[u.role]?.color || "#374151"
                                            }}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td style={{ padding: "14px 16px" }}>
                                            <span style={{
                                                padding: "4px 10px",
                                                borderRadius: "12px",
                                                fontSize: "12px",
                                                fontWeight: "500",
                                                background: u.status === "active" ? "#dcfce7" : "#fef9c3",
                                                color: u.status === "active" ? "#166534" : "#854d0e"
                                            }}>
                                                {u.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: "14px 16px", color: "#666" }}>
                                            {new Date(u.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {/* Paginación */}
                    {totalPages > 1 && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderTop: "1px solid #e5e5e5", background: "#f9fafb" }}>
                            <span style={{ fontSize: "14px", color: "#666" }}>
                                Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} de {filteredUsers.length}
                            </span>
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    style={{ padding: "8px 14px", border: "1px solid #ddd", borderRadius: "6px", background: currentPage === 1 ? "#f3f4f6" : "white", cursor: currentPage === 1 ? "not-allowed" : "pointer", fontSize: "14px" }}
                                >
                                    Anterior
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        style={{
                                            padding: "8px 12px",
                                            border: page === currentPage ? "none" : "1px solid #ddd",
                                            borderRadius: "6px",
                                            background: page === currentPage ? "#0a6ed1" : "white",
                                            color: page === currentPage ? "white" : "#333",
                                            cursor: "pointer",
                                            fontSize: "14px",
                                            fontWeight: page === currentPage ? "600" : "400"
                                        }}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    style={{ padding: "8px 14px", border: "1px solid #ddd", borderRadius: "6px", background: currentPage === totalPages ? "#f3f4f6" : "white", cursor: currentPage === totalPages ? "not-allowed" : "pointer", fontSize: "14px" }}
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de creación de usuario */}
            {showCreate && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                    <div style={{ background: "white", borderRadius: "12px", padding: "32px", width: "400px" }}>
                        <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px" }}>Nuevo Usuario</h3>
                        <input
                            type="text"
                            placeholder="Nombre de usuario"
                            value={newUsername}
                            onChange={e => setNewUsername(e.target.value)}
                            style={{ width: "100%", padding: "12px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "12px", boxSizing: "border-box" }}
                        />
                        <input
                            type="text"
                            placeholder="Contraseña (mín. 12 caracteres)"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            style={{ width: "100%", padding: "12px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "12px", boxSizing: "border-box" }}
                        />
                        <select
                            value={newRole}
                            onChange={e => setNewRole(e.target.value)}
                            style={{ width: "100%", padding: "12px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "20px", boxSizing: "border-box" }}
                        >
                            <option value="user">user</option>
                            <option value="project_head">project_head</option>
                            <option value="dept_head">dept_head</option>
                            <option value="admin">admin</option>
                        </select>
                        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                            <button onClick={() => setShowCreate(false)} style={{ padding: "10px 20px", background: "#f3f4f6", border: "none", borderRadius: "8px", cursor: "pointer" }}>
                                Cancelar
                            </button>
                            <button onClick={handleCreateUser} disabled={!newUsername || newPassword.length < 12} style={{ padding: "10px 20px", background: (newUsername && newPassword.length >= 12) ? "#0a6ed1" : "#d1d5db", color: "white", border: "none", borderRadius: "8px", cursor: (newUsername && newPassword.length >= 12) ? "pointer" : "not-allowed" }}>
                                Crear
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
