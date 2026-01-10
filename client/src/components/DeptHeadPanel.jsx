import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api/auth.api";

export default function DeptHeadPanel() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const isDeptHead = user?.role === "dept_head";

    useEffect(() => {
        if (!isDeptHead) return;

        async function fetchStats() {
            try {
                const res = await fetch(`${API_BASE}/departments/stats`, { credentials: "include" });
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
    }, [isDeptHead]);

    if (!isDeptHead) return null;

    if (loading) {
        return (
            <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
                Cargando estadísticas...
            </div>
        );
    }

    // Find max value for chart scaling
    const maxCount = stats?.projectGrowth ? Math.max(...stats.projectGrowth.map(d => d.count), 1) : 1;

    return (
        <div style={{ padding: "40px" }}>
            <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
                <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px" }}>
                    {stats?.departmentName || "Mi Departamento"}
                </h1>
                <p style={{ color: "#666", marginBottom: "32px" }}>Dashboard de tu departamento</p>

                {/* Stats Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", marginBottom: "32px" }}>
                    <div style={{ background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)", borderRadius: "16px", padding: "24px", color: "white" }}>
                        <div style={{ fontSize: "14px", opacity: 0.9 }}>Total Proyectos</div>
                        <div style={{ fontSize: "36px", fontWeight: "700", marginTop: "4px" }}>{stats?.totalProjects || 0}</div>
                    </div>
                    <div style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", borderRadius: "16px", padding: "24px", color: "white" }}>
                        <div style={{ fontSize: "14px", opacity: 0.9 }}>Total Documentos</div>
                        <div style={{ fontSize: "36px", fontWeight: "700", marginTop: "4px" }}>{stats?.totalFiles || 0}</div>
                    </div>
                </div>

                {/* Project Growth Chart */}
                <div style={{ background: "white", borderRadius: "16px", padding: "24px", marginBottom: "32px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                    <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px" }}>
                        📈 Nuevos proyectos - Último mes
                    </h2>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "120px" }}>
                        {stats?.projectGrowth?.map((day, idx) => (
                            <div
                                key={idx}
                                title={`${day.date}: ${day.count} proyectos`}
                                style={{
                                    flex: 1,
                                    height: `${Math.max((day.count / maxCount) * 100, 4)}%`,
                                    background: day.count > 0 ? "linear-gradient(180deg, #0ea5e9 0%, #0284c7 100%)" : "#e5e7eb",
                                    borderRadius: "3px 3px 0 0",
                                    minHeight: "4px",
                                    cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                            />
                        ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px", color: "#999" }}>
                        <span>{stats?.projectGrowth?.[0]?.date}</span>
                        <span>{stats?.projectGrowth?.[stats.projectGrowth.length - 1]?.date}</span>
                    </div>
                </div>

                {/* Recent Tables */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    {/* Recent Projects */}
                    <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                        <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
                            📁 Últimos 5 proyectos
                        </h2>
                        {!stats?.recentProjects?.length ? (
                            <p style={{ color: "#999", fontSize: "14px" }}>No hay proyectos.</p>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                                        <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Nombre</th>
                                        <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Líder</th>
                                        <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentProjects.map(p => (
                                        <tr key={p.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                                            <td style={{ padding: "10px 8px", fontWeight: "500", fontSize: "14px" }}>{p.name}</td>
                                            <td style={{ padding: "10px 8px", fontSize: "13px", color: "#666" }}>
                                                {p.leader?.username || "-"}
                                            </td>
                                            <td style={{ padding: "10px 8px", fontSize: "13px", color: "#666" }}>
                                                {new Date(p.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Recent Documents */}
                    <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                        <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
                            📄 Últimos 5 documentos
                        </h2>
                        {!stats?.recentFiles?.length ? (
                            <p style={{ color: "#999", fontSize: "14px" }}>No hay documentos.</p>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                                        <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Archivo</th>
                                        <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Autor</th>
                                        <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.recentFiles.map(f => (
                                        <tr key={f.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                                            <td style={{ padding: "10px 8px", fontWeight: "500", fontSize: "14px" }}>{f.filename}</td>
                                            <td style={{ padding: "10px 8px", fontSize: "13px", color: "#666" }}>
                                                {f.owner?.username || "-"}
                                            </td>
                                            <td style={{ padding: "10px 8px", fontSize: "13px", color: "#666" }}>
                                                {new Date(f.createdAt).toLocaleDateString()}
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
