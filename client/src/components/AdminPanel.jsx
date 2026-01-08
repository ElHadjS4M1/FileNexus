import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api/auth.api";

const ROLE_OPTIONS = [
  { value: "dept_head", label: "Jefe de departamento" },
  { value: "project_head", label: "Jefe de proyecto" },
  { value: "user", label: "Usuario estandar" },
];

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [form, setForm] = useState({
    username: "",
    role: "user",
    password: "TempPass123!",
  });

  const isAdmin = user?.role === "admin";

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [users],
  );

  async function fetchUsers() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/admin/users`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("No se pudieron cargar los usuarios.");
      }
      const payload = await response.json();
      setUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch (err) {
      setError(err.message ?? "Error inesperado al recuperar usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchUsers().catch(() => undefined);
    }
  }, [isAdmin]);

  async function handleCreateUser(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_BASE}/admin/users`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "No se pudo crear el usuario.");
      }
      setSuccessMessage("Usuario creado correctamente. Recuerda compartir la contrasena temporal.");
      setForm((prev) => ({ ...prev, username: "" }));
      await fetchUsers();
    } catch (err) {
      setError(err.message ?? "Error inesperado al crear el usuario.");
    }
  }

  if (!isAdmin) {
    return null;
  }

  const handleLogout = () => {
    void logout().catch(() => undefined);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center p-10">
      <div className="max-w-5xl w-full bg-white rounded-3xl shadow-2xl p-8 border border-indigo-100 space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Panel de administracion</h1>
            <p className="text-sm text-gray-600">
              Gestiona cuentas con contrasenas temporales y revisa el estado de inicializacion.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl border border-indigo-200 text-indigo-600 font-semibold hover:bg-indigo-50 transition"
          >
            Cerrar sesion
          </button>
        </div>

        {error && <p className="text-red-600 text-sm text-center">{error}</p>}
        {successMessage && <p className="text-emerald-600 text-sm text-center">{successMessage}</p>}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Usuarios registrados</h2>
            <button
              type="button"
              onClick={() => fetchUsers().catch(() => undefined)}
              disabled={loading}
              className="px-4 py-2 rounded-xl border border-indigo-200 text-indigo-600 font-semibold hover:bg-indigo-50 transition disabled:opacity-60"
            >
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          {sortedUsers.length === 0 ? (
            <p className="text-sm text-gray-600">
              {loading ? "Cargando usuarios..." : "No hay usuarios registrados."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-xl text-sm">
                <thead className="bg-indigo-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Usuario</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Rol</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Estado</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((item) => (
                    <tr key={item.id} className="border-t border-gray-200">
                      <td className="px-4 py-2 text-gray-800">{item.username}</td>
                      <td className="px-4 py-2 text-gray-600">{renderRole(item.role)}</td>
                      <td className="px-4 py-2 text-gray-600">
                        {item.status === "pending_init" ? "Pendiente de inicializar" : "Activo"}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Crear nuevo usuario</h2>
          <form
            onSubmit={handleCreateUser}
            className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-600">Usuario</label>
              <input
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
                placeholder="nombre.apellidos"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">Rol</label>
              <select
                value={form.role}
                onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                className="mt-1 w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600">
                Contrasena temporal (compartela con el usuario)
              </label>
              <input
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                required
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow hover:bg-indigo-700 transition disabled:opacity-60"
              >
                Crear usuario
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function renderRole(value) {
  const match = ROLE_OPTIONS.find((role) => role.value === value);
  if (match) {
    return match.label;
  }
  if (value === "admin") {
    return "Administrador";
  }
  return value;
}
