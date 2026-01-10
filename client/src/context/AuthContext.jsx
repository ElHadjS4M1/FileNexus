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
  const [sessionUser, setSessionUser] = useState(null); // User info from server (no keys)
  const [loading, setLoading] = useState(true); // Loading session check

  // Check session on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const result = await authApi.checkSession();
        // /me returns user object directly (not wrapped in {user: ...})
        if (result && result.id && result.username) {
          // Session valid but keys not unlocked
          setSessionUser(result);
        }
      } catch {
        // No valid session
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

  // Unlock keys with password (when session exists but keys not loaded)
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
    setSessionUser(null); // Clear session user since we now have full user
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
        sessionUser, // For showing unlock screen
        loading, // For showing loading state
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
