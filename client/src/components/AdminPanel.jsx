import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api/auth.api";

export default function AdminPanel() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;

    async function fetchStats() {
      try {
        const res = await fetch(`${API_BASE}/admin/stats`, { credentials: "include" });
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
  }, [isAdmin]);

  if (!isAdmin) return null;

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
        Cargando estadísticas...
      </div>
    );
  }

  // Encontrar valor máximo para escala del gráfico
  const maxCount = stats?.userGrowth ? Math.max(...stats.userGrowth.map(d => d.count), 1) : 1;

  const roleColors = {
    admin: { bg: "#fee2e2", color: "#dc2626" },
    dept_head: { bg: "#fef3c7", color: "#d97706" },
    project_head: { bg: "#dbeafe", color: "#2563eb" },
    user: { bg: "#e5e7eb", color: "#374151" },
  };

  return (
    <div style={{ padding: "40px" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px" }}>Dashboard</h1>
        <p style={{ color: "#666", marginBottom: "32px" }}>Resumen de actividad del sistema</p>

        {/* Tarjetas de estadísticas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", marginBottom: "32px" }}>
          <div style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", borderRadius: "16px", padding: "24px", color: "white" }}>
            <div style={{ fontSize: "14px", opacity: 0.9 }}>Total Usuarios</div>
            <div style={{ fontSize: "36px", fontWeight: "700", marginTop: "4px" }}>{stats?.totalUsers || 0}</div>
          </div>
          <div style={{ background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", borderRadius: "16px", padding: "24px", color: "white" }}>
            <div style={{ fontSize: "14px", opacity: 0.9 }}>Total Departamentos</div>
            <div style={{ fontSize: "36px", fontWeight: "700", marginTop: "4px" }}>{stats?.totalDepartments || 0}</div>
          </div>
        </div>

        {/* Gráfico de crecimiento de usuarios */}
        <div style={{ background: "white", borderRadius: "16px", padding: "24px", marginBottom: "32px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "20px" }}>
            📈 Nuevos usuarios - Último mes
          </h2>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "120px" }}>
            {stats?.userGrowth?.map((day, idx) => (
              <div
                key={idx}
                title={`${day.date}: ${day.count} usuarios`}
                style={{
                  flex: 1,
                  height: `${Math.max((day.count / maxCount) * 100, 4)}%`,
                  background: day.count > 0 ? "linear-gradient(180deg, #667eea 0%, #764ba2 100%)" : "#e5e7eb",
                  borderRadius: "3px 3px 0 0",
                  minHeight: "4px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px", color: "#999" }}>
            <span>{stats?.userGrowth?.[0]?.date}</span>
            <span>{stats?.userGrowth?.[stats.userGrowth.length - 1]?.date}</span>
          </div>
        </div>

        {/* Tablas recientes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Usuarios recientes */}
          <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
              👤 Últimos 5 usuarios
            </h2>
            {!stats?.recentUsers?.length ? (
              <p style={{ color: "#999", fontSize: "14px" }}>No hay usuarios.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                    <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Usuario</th>
                    <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Rol</th>
                    <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "10px 8px", fontWeight: "500", fontSize: "14px" }}>{u.username}</td>
                      <td style={{ padding: "10px 8px" }}>
                        <span style={{
                          padding: "3px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "500",
                          background: roleColors[u.role]?.bg || "#e5e7eb",
                          color: roleColors[u.role]?.color || "#374151"
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: "10px 8px", fontSize: "13px", color: "#666" }}>
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Departamentos recientes */}
          <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>
              🏢 Últimos 5 departamentos
            </h2>
            {!stats?.recentDepartments?.length ? (
              <p style={{ color: "#999", fontSize: "14px" }}>No hay departamentos.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
                    <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Nombre</th>
                    <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Jefe</th>
                    <th style={{ padding: "10px 8px", textAlign: "left", fontWeight: "600", fontSize: "13px", color: "#666" }}>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentDepartments.map(d => (
                    <tr key={d.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "10px 8px", fontWeight: "500", fontSize: "14px" }}>{d.name}</td>
                      <td style={{ padding: "10px 8px", fontSize: "13px", color: "#666" }}>
                        {d.manager?.username || <span style={{ color: "#f59e0b" }}>Sin asignar</span>}
                      </td>
                      <td style={{ padding: "10px 8px", fontSize: "13px", color: "#666" }}>
                        {new Date(d.createdAt).toLocaleDateString()}
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
