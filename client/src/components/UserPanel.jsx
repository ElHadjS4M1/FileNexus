import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api/auth.api";

export default function UserPanel() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const isUser = user?.role === "user";

    useEffect(() => {
        if (!isUser) return;

        async function fetchStats() {
            try {
                const res = await fetch(`${API_BASE}/users/stats`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, [isUser]);

    if (!isUser) return null;

    if (loading) {
        return (
            <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
                Cargando estadísticas...
            </div>
        );
    }

    // Encontrar valor máximo para escala del gráfico
    const maxCount = stats?.fileGrowth ? Math.max(...stats.fileGrowth.map(d => d.count), 1) : 1;

    return (
        <div style={{ padding: "40px" }}>
            <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
                <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px" }}>
                    Mi Dashboard
                </h1>
                <p style={{ color: "#666", marginBottom: "32px" }}>Bienvenido, {user?.username}</p>

                {/* Tarjetas de estadísticas */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", marginBottom: "32px" }}>
                    <div style={{ background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)", borderRadius: "16px", padding: "24px", color: "white" }}>
                        <div style={{ fontSize: "14px", opacity: 0.9 }}>Mis Documentos</div>
                        <div style={{ fontSize: "36px", fontWeight: "700", marginTop: "4px" }}>{stats?.totalOwnedFiles || 0}</div>
                    </div>
                    <div style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)", borderRadius: "16px", padding: "24px", color: "white" }}>
                        <div style={{ fontSize: "14px", opacity: 0.9 }}>Compartidos Conmigo</div>
                        <div style={{ fontSize: "36px", fontWeight: "700", marginTop: "4px" }}>{stats?.totalSharedFiles || 0}</div>
                    </div>
                </div>

                {/* Gráfico de crecimiento de archivos */}
                <div style={{ background: "white", borderRadius: "16px", padding: "24px", marginBottom: "32px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                    <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px" }}>
                        📈 Mis archivos - Último mes
                    </h2>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "120px" }}>
                        {stats?.fileGrowth?.map((day, idx) => (
                            <div
                                key={idx}
                                title={`${day.date}: ${day.count} archivos`}
                                style={{
                                    flex: 1,
                                    height: `${Math.max((day.count / maxCount) * 100, 4)}%`,
                                    background: day.count > 0 ? "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)" : "#e5e7eb",
                                    borderRadius: "3px 3px 0 0",
                                    minHeight: "4px",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                            />
                        ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px", color: "#999" }}>
                        <span>{stats?.fileGrowth?.[0]?.date}</span>
                        <span>{stats?.fileGrowth?.[stats.fileGrowth.length - 1]?.date}</span>
                    </div>
                </div>

                {/* Tablas recientes */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    {/* Archivos propios recientes */}
                    <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                        <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
                            📁 Últimos 5 documentos subidos
                        </h2>
                        {!stats?.recentOwnedFiles?.length ? (
                            <p style={{ color: "#999", fontSize: "14px" }}>No hay documentos.</p>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                                        <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Archivo</th>
                                        <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentOwnedFiles.map((f, idx) => (
                                        <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                                            <td style={{ padding: "10px 8px", fontWeight: "500", fontSize: "14px" }}>{f.filename}</td>
                                            <td style={{ padding: "10px 8px", fontSize: "13px", color: "#666" }}>
                                                {new Date(f.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Archivos compartidos recientes */}
                    <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                        <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
                            🔗 Últimos 5 compartidos conmigo
                        </h2>
                        {!stats?.recentSharedFiles?.length ? (
                            <p style={{ color: "#999", fontSize: "14px" }}>No hay documentos compartidos.</p>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                                        <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Archivo</th>
                                        <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Compartido por</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentSharedFiles.map((f, idx) => (
                                        <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                                            <td style={{ padding: "10px 8px", fontWeight: "500", fontSize: "14px" }}>{f.filename}</td>
                                            <td style={{ padding: "10px 8px", fontSize: "13px", color: "#666" }}>
                                                {f.sharedBy || "-"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
