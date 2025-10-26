import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateAndEncryptRSAKeys } from "../utils/cryptoUtils";
import { useAuth } from "../context/AuthContext";

function LogInIcon({ size = 24, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  );
}

function LockIcon({ size = 24, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <path d="M12 16v2" />
    </svg>
  );
}

export default function FirstLoginChangePassword() {
  const navigate = useNavigate();
  const { registerUser, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [initToken, setInitToken] = useState(null);

  function validatePasswordRules(pwd) {
    const errors = [];
    if (pwd.length < 12) errors.push("Debe tener al menos 12 caracteres.");
    if (!/[A-Z]/.test(pwd)) errors.push("Debe incluir una letra mayúscula.");
    if (!/[a-z]/.test(pwd)) errors.push("Debe incluir una letra minúscula.");
    if (!/\d/.test(pwd)) errors.push("Debe incluir un número.");
    if (!/[!@#$%^&*(),.?\":{}|<>]/.test(pwd)) {
      errors.push("Debe incluir un carácter especial.");
    }
    return errors;
  }

  async function handleLogin(event) {
    event.preventDefault();
    setProcessing(true);
    setStatusMessage("");
    try {
      const result = await login(username, password);
      if (result?.requiresInit) {
        setIsFirstLogin(true);
        setInitToken(result.initToken);
        setShowChangeModal(true);
        return;
      }
      if (result?.requiresTotp) {
        setStatusMessage("Se requiere validar TOTP desde otro cliente.");
        return;
      }
      if (result?.success) {
        navigate("/file-crypto", { state: { username } });
      } else {
        setStatusMessage("Credenciales incorrectas o cuenta sin inicializar.");
      }
    } catch (err) {
      setStatusMessage(err.message ?? "Error en el login.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleChangePasswordSubmit(event) {
    event.preventDefault();
    setValidationErrors([]);
    const errors = validatePasswordRules(newPassword);
    if (newPassword !== confirmPassword) {
      errors.push("Las contraseñas no coinciden.");
    }
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    if (!initToken) {
      setStatusMessage("Falta el token de inicialización. Inicia sesión de nuevo.");
      return;
    }
    setProcessing(true);
    try {
      const keyBundle = await generateAndEncryptRSAKeys(username, newPassword);
      await registerUser({ initToken, passwordNew: newPassword, keyBundle });
      const result = await login(username, newPassword);
      if (result?.success) {
        navigate("/file-crypto", { state: { username } });
      } else {
        setStatusMessage("Error durante el registro o login.");
      }
    } catch (err) {
      setStatusMessage(err.message ?? "Error durante el proceso de registro o login.");
    } finally {
      setProcessing(false);
      setShowChangeModal(false);
      setInitToken(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-blue-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white/90 backdrop-blur-md border border-indigo-100 rounded-3xl shadow-2xl p-8">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-indigo-600 text-white p-3 rounded-full shadow-md">
            <LogInIcon size={28} className="text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Acceso Seguro</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600">Usuario</label>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
              placeholder="usuario@correo.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
              placeholder="********"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Usa tu contraseña temporal si es tu primer acceso.
            </p>
          </div>
          <button
            type="submit"
            disabled={processing}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
          >
            {processing ? "Procesando..." : "Entrar"}
          </button>
        </form>
        {statusMessage && (
          <p className="mt-4 text-center text-sm text-red-600">{statusMessage}</p>
        )}

        {showChangeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-lg bg-white rounded-2xl p-8 shadow-2xl">
              <div className="flex items-center mb-4 gap-3">
                <LockIcon className="text-indigo-600" size={24} />
                <h3 className="text-lg font-semibold text-gray-800">
                  Primer acceso – Cambia tu contraseña
                </h3>
              </div>
              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">Nueva contraseña</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="mt-1 w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                    placeholder="Nueva contraseña segura"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Confirmar contraseña</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="mt-1 w-full p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
                    placeholder="Repite la contraseña"
                    required
                  />
                </div>
                {validationErrors.length > 0 && (
                  <ul className="text-sm text-red-600 list-disc pl-5">
                    {validationErrors.map((err, index) => (
                      <li key={index}>{err}</li>
                    ))}
                  </ul>
                )}
                <div className="flex justify-end gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangeModal(false);
                      setInitToken(null);
                    }}
                    className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-100 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition disabled:opacity-60"
                  >
                    {processing ? "Generando..." : "Confirmar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
