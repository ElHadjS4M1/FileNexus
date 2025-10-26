import React, { createContext, useContext, useState } from "react";
import {
  importPrivateKeyFromPkcs8Base64,
  decryptPrivateKeyAesGcm,
  deriveAesKeyFromPasswordHalf,
} from "../utils/cryptoUtils";

const AuthContext = createContext();
export const API_BASE = import.meta.env.VITE_API_BASE ?? "https://localhost:4000";

function buildHeaders(hasBody, customHeaders = {}) {
  return {
    ...(hasBody ? { "Content-Type": "application/json" } : {}),
    ...customHeaders,
  };
}

async function apiRequest(path, options = {}) {
  const hasBody = typeof options.body !== "undefined";
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: buildHeaders(hasBody, options.headers),
  });

  if (response.status === 204) {
    return { ok: true };
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : "Solicitud rechazada";
    throw new Error(message);
  }
  return body;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  async function registerUser({ initToken, passwordNew, keyBundle }) {
    await apiRequest("/auth/init", {
      method: "POST",
      body: JSON.stringify({
        initToken,
        passwordNew,
        publicKeyPem: keyBundle.publicKeyPEM,
        encryptedPrivateKey: keyBundle.encryptedPrivateKey,
        encryptionMetadata: keyBundle.encryptionMetadata,
      }),
    });
  }

  async function login(username, password, totp) {
    const body = { username, password };
    if (totp) {
      body.totp = totp;
    }
    const loginResponse = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (loginResponse.requiresInit) {
      return { requiresInit: true, initToken: loginResponse.initToken };
    }
    if (loginResponse.requiresTotp) {
      return { requiresTotp: true };
    }
    if (!loginResponse.user) {
      return { success: false };
    }

    const materials = await apiRequest("/me/keys/materials");
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
    };

    setUser(finalUser);
    return { success: true, user: finalUser };
  }

  async function requestTotpSetup(label) {
    const body = label ? { label } : {};
    return apiRequest("/auth/totp/setup", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async function confirmTotpSetup(token) {
    return apiRequest("/auth/totp/setup", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }

  async function logout() {
    await apiRequest("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
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
