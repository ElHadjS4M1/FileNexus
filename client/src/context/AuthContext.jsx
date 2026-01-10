import React, { createContext, useContext, useState, useEffect } from "react";
import {
  importPrivateKeyFromPkcs8Base64,
  decryptPrivateKeyAesGcm,
  deriveAesKeyFromPasswordHalf,
} from "../utils/cryptoUtils";
import { authApi } from "../api/auth.api";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessionUser, setSessionUser] = useState(null); // Información del usuario desde el servidor (sin claves)
  const [loading, setLoading] = useState(true); // Cargando comprobación de sesión

  // Comprobar sesión al montar
  useEffect(() => {
    async function checkSession() {
      try {
        const result = await authApi.checkSession();
        // /me devuelve el objeto de usuario directamente (no envuelto en {user: ...})
        if (result && result.id && result.username) {
          // Sesión válida pero claves no desbloqueadas
          setSessionUser(result);
        }
      } catch {
        // Sin sesión válida
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  async function registerUser({ initToken, passwordNew, keyBundle }) {
    await authApi.init({
      initToken,
      passwordNew,
      publicKeyPem: keyBundle.publicKeyPEM,
      encryptedPrivateKey: keyBundle.encryptedPrivateKey,
      encryptionMetadata: keyBundle.encryptionMetadata,
    });
  }

  // Desbloquear claves con contraseña (cuando existe sesión pero las claves no están cargadas)
  async function unlockWithPassword(password) {
    if (!sessionUser) {
      throw new Error("No hay sesión activa");
    }

    const materials = await authApi.getMaterials();
    const metadata = materials.encryptionMetadata ?? {};
    const hkdfSalt = metadata.hkdfSalt ?? materials.clientSalt;
    const iv = metadata.iv ?? materials.privNonce;
    const encryptedPrivateKey = materials.encryptedPrivateKey ?? materials.privEnc;

    if (!hkdfSalt || !iv || !encryptedPrivateKey) {
      throw new Error("Materiales criptograficos incompletos");
    }

    const { aesKey } = await deriveAesKeyFromPasswordHalf(password, hkdfSalt);
    const privateKeyBase64 = await decryptPrivateKeyAesGcm(aesKey, encryptedPrivateKey, iv);
    const privateKeyCryptoKey = await importPrivateKeyFromPkcs8Base64(privateKeyBase64);

    const publicKeyPEM =
      materials.publicKeyPem ??
      (materials.publicKeyJwk && materials.publicKeyJwk.pem) ??
      null;

    if (!publicKeyPEM) {
      throw new Error("No se pudo recuperar la clave publica del usuario");
    }

    const finalUser = {
      id: sessionUser.id,
      username: materials.username ?? sessionUser.username,
      role: sessionUser.role,
      totpEnabled: Boolean(sessionUser.totpEnabled),
      publicKeyPEM,
      privateKeyCryptoKey,
      privateKeyPkcs8Base64: privateKeyBase64,
    };

    setUser(finalUser);
    setSessionUser(null); // Limpiar usuario de sesión ya que ahora tenemos el usuario completo
    return { success: true, user: finalUser };
  }

  async function login(username, password, totp) {
    const payload = { username, password };
    if (totp) {
      payload.totp = totp;
    }

    const loginResponse = await authApi.login(payload);

    if (loginResponse.requiresInit) {
      return { requiresInit: true, initToken: loginResponse.initToken };
    }
    if (loginResponse.requiresTotp) {
      return { requiresTotp: true };
    }
    if (!loginResponse.user) {
      return { success: false };
    }

    const materials = await authApi.getMaterials();
    const metadata = materials.encryptionMetadata ?? {};
    const hkdfSalt = metadata.hkdfSalt ?? materials.clientSalt;
    const iv = metadata.iv ?? materials.privNonce;
    const encryptedPrivateKey = materials.encryptedPrivateKey ?? materials.privEnc;

    if (!hkdfSalt || !iv || !encryptedPrivateKey) {
      throw new Error("Materiales criptograficos incompletos");
    }

    const { aesKey } = await deriveAesKeyFromPasswordHalf(password, hkdfSalt);
    const privateKeyBase64 = await decryptPrivateKeyAesGcm(aesKey, encryptedPrivateKey, iv);
    const privateKeyCryptoKey = await importPrivateKeyFromPkcs8Base64(privateKeyBase64);

    const publicKeyPEM =
      materials.publicKeyPem ??
      (materials.publicKeyJwk && materials.publicKeyJwk.pem) ??
      null;

    if (!publicKeyPEM) {
      throw new Error("No se pudo recuperar la clave publica del usuario");
    }

    const finalUser = {
      id: loginResponse.user.id,
      username: materials.username ?? loginResponse.user.username ?? username,
      role: loginResponse.user.role,
      totpEnabled: Boolean(loginResponse.user.totpEnabled),
      publicKeyPEM,
      privateKeyCryptoKey,
      privateKeyPkcs8Base64: privateKeyBase64,
    };

    setUser(finalUser);
    setSessionUser(null);
    return { success: true, user: finalUser };
  }

  async function requestTotpSetup(label) {
    return authApi.setupTotp(label ? { label } : {});
  }

  async function confirmTotpSetup(token) {
    return authApi.setupTotp({ token });
  }

  async function logout() {
    await authApi.logout().catch(() => { });
    setUser(null);
    setSessionUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        sessionUser, // Para mostrar pantalla de desbloqueo
        loading, // Para mostrar estado de carga
        login,
        logout,
        unlockWithPassword,
        registerUser,
        requestTotpSetup,
        confirmTotpSetup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
