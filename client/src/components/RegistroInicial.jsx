import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateAndEncryptRSAKeys } from "../utils/cryptoUtils";
import { useAuth } from "../context/AuthContext";
import QRCode from "qrcode";
import { Input, Button, Modal } from "./ui";

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
  const { registerUser, login, logout, requestTotpSetup, confirmTotpSetup } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationErrors, setValidationErrors] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");
  const [processing, setProcessing] = useState(false);
  const [initToken, setInitToken] = useState(null);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [totpValue, setTotpValue] = useState("");
  const [showTotpSetup, setShowTotpSetup] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState(null);
  const [totpSetupCode, setTotpSetupCode] = useState("");
  const [totpSetupError, setTotpSetupError] = useState("");
  const [totpSetupProcessing, setTotpSetupProcessing] = useState(false);
  const [totpQrDataUrl, setTotpQrDataUrl] = useState("");
  const [totpQrError, setTotpQrError] = useState("");

  function validatePasswordRules(pwd) {
    const errors = [];
    if (pwd.length < 12) errors.push("Debe tener al menos 12 caracteres.");
    if (!/[A-Z]/.test(pwd)) errors.push("Debe incluir una letra mayuscula.");
    if (!/[a-z]/.test(pwd)) errors.push("Debe incluir una letra minuscula.");
    if (!/\d/.test(pwd)) errors.push("Debe incluir un numero.");
    if (!/[!@#$%^&*(),.?\":{}|<>]/.test(pwd)) {
      errors.push("Debe incluir un caracter especial.");
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
        setInitToken(result.initToken);
        setShowChangeModal(true);
        return;
      }
      if (result?.requiresTotp) {
        setNeedsTotp(true);
        setTotpValue("");
        setStatusMessage("Introduce el codigo TOTP de 6 digitos.");
        return;
      }
      if (result?.success && result.user) {
        if (!result.user.totpEnabled) {
          try {
            const setup = await requestTotpSetup(`ProtectInfo (${username})`);
            setTotpSetupData(setup);
            setShowTotpSetup(true);
            setStatusMessage(
              "Escanea el QR, introduce el codigo TOTP y confirma para completar la configuracion.",
            );
          } catch (setupError) {
            setStatusMessage(
              setupError.message ??
              "No se pudo iniciar la configuracion TOTP. Intenta iniciar sesion de nuevo.",
            );
          }
          return;
        }
        navigate("/dashboard", { state: { username, role: result.user.role } });
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
      errors.push("Las contrasenas no coinciden.");
    }
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    if (!initToken) {
      setStatusMessage("Falta el token de inicializacion. Inicia sesion de nuevo.");
      return;
    }
    setProcessing(true);
    try {
      const keyBundle = await generateAndEncryptRSAKeys(username, newPassword);
      await registerUser({ initToken, passwordNew: newPassword, keyBundle });
      const result = await login(username, newPassword);
      if (result?.success && result.user) {
        setPassword(newPassword);
        setShowChangeModal(false);
        setInitToken(null);
        try {
          const setup = await requestTotpSetup(`ProtectInfo (${username})`);
          setTotpSetupData(setup);
          setShowTotpSetup(true);
          setStatusMessage(
            "Escanea el QR, introduce el codigo TOTP y confirma para completar la configuracion.",
          );
        } catch (setupError) {
          setStatusMessage(
            setupError.message ??
            "No se pudo iniciar la configuracion TOTP. Intenta iniciar sesion de nuevo.",
          );
        }
        return;
      }
      setStatusMessage("Error durante el registro o login.");
    } catch (err) {
      setStatusMessage(err.message ?? "Error durante el proceso de registro o login.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleTotpSubmit(event) {
    event.preventDefault();
    if (!totpValue || totpValue.length !== 6) {
      setStatusMessage("El codigo TOTP debe tener 6 digitos.");
      return;
    }
    setProcessing(true);
    try {
      const result = await login(username, password, totpValue);
      if (result?.success && result.user) {
        setNeedsTotp(false);
        setTotpValue("");
        navigate("/dashboard", { state: { username, role: result.user.role } });
      } else if (result?.requiresTotp) {
        setStatusMessage("Codigo incorrecto. Intentalo de nuevo.");
        setTotpValue("");
      } else {
        setStatusMessage("Error durante la verificacion TOTP.");
      }
    } catch (err) {
      setStatusMessage(err.message ?? "No se pudo validar el TOTP.");
      setTotpValue("");
    } finally {
      setProcessing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    if (showTotpSetup && totpSetupData?.otpauthUrl) {
      QRCode.toDataURL(totpSetupData.otpauthUrl)
        .then((url) => {
          if (cancelled) return;
          setTotpQrDataUrl(url);
          setTotpQrError("");
        })
        .catch(() => {
          if (cancelled) return;
          setTotpQrDataUrl("");
          setTotpQrError("No se pudo generar el codigo QR. Usa el codigo manual.");
        });
    } else {
      setTotpQrDataUrl("");
      setTotpQrError("");
    }
    return () => {
      cancelled = true;
    };
  }, [showTotpSetup, totpSetupData?.otpauthUrl]);

  async function handleTotpSetupSubmit(event) {
    event.preventDefault();
    if (!totpSetupCode || totpSetupCode.length !== 6) {
      setTotpSetupError("El codigo TOTP debe tener 6 digitos.");
      return;
    }
    setTotpSetupProcessing(true);
    setTotpSetupError("");
    try {
      await confirmTotpSetup(totpSetupCode);
      await logout();
      setShowTotpSetup(false);
      setTotpSetupData(null);
      setTotpSetupCode("");
      setStatusMessage("TOTP configurado correctamente. Inicia sesion con tu nueva contrasena y codigo.");
      navigate("/", { replace: true });
    } catch (err) {
      setTotpSetupError(err.message ?? "Codigo invalido. Intentalo de nuevo.");
    } finally {
      setTotpSetupProcessing(false);
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
          <Input
            label="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="usuario@correo.com"
            required
          />
          <Input
            label="Contrasena"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Usa tu contrasena temporal si es tu primer acceso.
          </p>
          <Button type="submit" processing={processing} className="bg-indigo-600 text-white hover:bg-indigo-700">
            {processing ? "Procesando..." : "Entrar"}
          </Button>
        </form>
        {statusMessage && (
          <p className="mt-4 text-center text-sm text-red-600">{statusMessage}</p>
        )}

        <Modal isOpen={showChangeModal} onClose={() => { }}>
          <div className="flex items-center mb-4 gap-3">
            <LockIcon className="text-indigo-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">
              Primer acceso - Cambia tu contrasena
            </h3>
          </div>
          <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
            <Input
              label="Nueva contrasena"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contrasena segura"
              required
            />
            <Input
              label="Confirmar contrasena"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la contrasena"
              required
            />
            {validationErrors.length > 0 && (
              <ul className="text-sm text-red-600 list-disc pl-5">
                {validationErrors.map((err, index) => (
                  <li key={index}>{err}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <Button
                type="button"
                onClick={() => {
                  setShowChangeModal(false);
                  setInitToken(null);
                }}
                className="bg-white border text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                processing={processing}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {processing ? "Generando..." : "Confirmar"}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={needsTotp} onClose={() => setNeedsTotp(false)}>
          <div className="flex items-center gap-3 mb-4">
            <LockIcon className="text-indigo-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">Verificacion TOTP</h3>
          </div>
          <form onSubmit={handleTotpSubmit} className="space-y-4">
            <Input
              label="Introduce el codigo de tu app autenticadora"
              value={totpValue}
              onChange={(e) => setTotpValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              required
            />
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                onClick={() => {
                  setNeedsTotp(false);
                  setTotpValue("");
                }}
                className="bg-white border text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                processing={processing}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {processing ? "Verificando..." : "Validar TOTP"}
              </Button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={showTotpSetup} onClose={() => { }}>
          <div className="flex items-center gap-3 mb-4">
            <LockIcon className="text-indigo-600" size={24} />
            <h3 className="text-lg font-semibold text-gray-800">Configura tu TOTP</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Escanea el codigo QR con tu app autenticadora o introduce el codigo manual. Luego escribe el primer
            codigo generado para confirmar.
          </p>
          {totpQrDataUrl ? (
            <div className="flex justify-center mb-4">
              <img
                src={totpQrDataUrl}
                alt="QR TOTP"
                className="rounded-xl border border-indigo-100 p-3 bg-white"
                width={220}
                height={220}
              />
            </div>
          ) : totpQrError ? (
            <p className="text-sm text-red-600 text-center mb-4">{totpQrError}</p>
          ) : null}
          {totpSetupData?.secretBase32 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-gray-700 mb-4">
              <span>Codigo manual:</span>
              <code className="manual-code ml-2 font-mono font-bold">{totpSetupData.secretBase32}</code>
            </div>
          )}
          <form onSubmit={handleTotpSetupSubmit} className="space-y-3">
            <Input
              label="Codigo TOTP de 6 digitos"
              value={totpSetupCode}
              onChange={(e) => setTotpSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              required
              error={totpSetupError}
            />
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                onClick={() => {
                  void (async () => {
                    await logout().catch(() => undefined);
                    setShowTotpSetup(false);
                    setTotpSetupData(null);
                    setTotpSetupCode("");
                    setTotpQrDataUrl("");
                    setTotpQrError("");
                    setStatusMessage("Configuracion TOTP cancelada. Inicia sesion para completarla.");
                    navigate("/", { replace: true });
                  })();
                }}
                className="bg-white border text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                processing={totpSetupProcessing}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {totpSetupProcessing ? "Verificando..." : "Confirmar TOTP"}
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
