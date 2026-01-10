import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api/auth.api";
import {
  encryptFileWithAesGcm,
  exportAesKeyRawBase64,
  importPublicKeyFromPem,
  encryptAesKeyWithPublicKey,
  importAesKeyFromRawBase64,
  decryptAesKeyWithPrivateKey,
  decryptFileWithAesGcm,
  sha256Base64,
  arrayBufferToBase64,
  importPrivateKeyForSigning,
  signHash,
  encryptKeyForRecipients,
} from "../utils/fileCryptoUtils";

const UploadIcon = ({ size = 24, className = "" }) => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const DownloadIcon = ({ size = 24, className = "" }) => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const ShieldIcon = ({ size = 24, className = "" }) => (
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
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export default function FileCryptoDemo() {
  const { user, logout } = useAuth();
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [filesStored, setFilesStored] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [errorPopup, setErrorPopup] = useState(null); // For signature error popup
  const [userProject, setUserProject] = useState(null); // User's team project
  const [shareWithTeam, setShareWithTeam] = useState(false); // Checkbox state

  // Fetch user's project (if they belong to one)
  useEffect(() => {
    if (!user) {
      setUserProject(null);
      return;
    }
    const fetchProject = async () => {
      try {
        const res = await fetch(`${API_BASE}/projects`, { credentials: "include" });
        console.log("Projects fetch response:", res.status);
        if (res.ok) {
          const data = await res.json();
          console.log("Projects data:", data);
          if (data.projects && data.projects.length > 0) {
            setUserProject(data.projects[0]);
            console.log("Set userProject:", data.projects[0]);
          } else {
            console.log("No projects found for user");
          }
        }
      } catch (err) {
        console.error("Error fetching projects:", err);
      }
    };
    fetchProject();
  }, [user]);

  const fetchFiles = useCallback(async () => {
    if (!user) {
      setFilesStored([]);
      return;
    }
    setLoadingFiles(true);
    try {
      const response = await fetch(`${API_BASE}/files`, { credentials: "include" });
      if (!response.ok) {
        throw new Error("No se pudo listar los documentos cifrados.");
      }
      const data = await response.json();
      setFilesStored(data.files ?? []);
    } catch (error) {
      setMessage(error.message ?? "No se pudieron cargar los documentos.");
    } finally {
      setLoadingFiles(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFiles().catch(() => undefined);
  }, [fetchFiles]);

  const handleEncrypt = async () => {
    if (!file) {
      setMessage("Selecciona un archivo primero.");
      return;
    }
    if (!user || !user.publicKeyPEM) {
      setMessage("Debes iniciar sesion y tener claves inicializadas.");
      return;
    }
    setWorking(true);
    try {
      const meta = await encryptFileWithAesGcm(file);
      const aesRaw = await exportAesKeyRawBase64(meta.aesKey);

      const publicKey = await importPublicKeyFromPem(user.publicKeyPEM);
      const wrappedKey = await encryptAesKeyWithPublicKey(aesRaw, publicKey);

      const fileBuffer = await file.arrayBuffer();
      const hashC = await sha256Base64(fileBuffer);

      // Sign the hash with private key
      let signatureBase64 = null;
      if (user.privateKeyPkcs8Base64) {
        console.log("Signing file with private key...");
        try {
          const signingKey = await importPrivateKeyForSigning(user.privateKeyPkcs8Base64);
          signatureBase64 = await signHash(hashC, signingKey);
          console.log("File signed successfully, signature length:", signatureBase64.length);
        } catch (signError) {
          console.error("Error signing file:", signError);
        }
      } else {
        console.log("No privateKeyPkcs8Base64 available, skipping signature");
      }

      const ciphertextBlob = new Blob([meta.ciphertext], { type: "application/octet-stream" });
      const formData = new FormData();
      formData.append("ciphertext", ciphertextBlob, `${file.name}.enc`);
      formData.append("filename", file.name);
      formData.append("sizeBytes", String(file.size));
      formData.append("aeadNonce", arrayBufferToBase64(meta.iv.buffer));
      formData.append("ekOwner", wrappedKey);
      formData.append("hashC", hashC);
      if (signatureBase64) {
        formData.append("signature", signatureBase64);
        console.log("Signature added to form data");
      }

      // Handle team sharing
      let encryptedKeysForTeam = [];
      if (shareWithTeam && userProject) {
        console.log("Sharing with team, fetching members' keys...");
        try {
          const keysRes = await fetch(`${API_BASE}/projects/${userProject.id}/members/keys`, {
            credentials: "include",
          });
          if (keysRes.ok) {
            const keysData = await keysRes.json();
            if (keysData.recipients && keysData.recipients.length > 0) {
              encryptedKeysForTeam = await encryptKeyForRecipients(aesRaw, keysData.recipients);
              console.log(`Encrypted key for ${encryptedKeysForTeam.length} team members`);
            }
          }
        } catch (teamErr) {
          console.error("Error sharing with team:", teamErr);
        }
        formData.append("projectId", userProject.id);
        formData.append("encryptedKeys", JSON.stringify(encryptedKeysForTeam));
      }

      formData.append(
        "meta",
        JSON.stringify({
          mimeType: meta.mimeType,
          originalName: file.name,
          recipients: [
            {
              id: user.username,
              encryptedAesKeyBase64: wrappedKey,
              publicKeyPEM: user.publicKeyPEM,
            },
          ],
        }),
      );

      const response = await fetch(`${API_BASE}/files`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "Fallo al subir el documento cifrado.");
      }

      meta.aesKey = null;
      meta.ciphertext = new Uint8Array();
      meta.iv = new Uint8Array();
      setMessage("Documento cifrado, firmado y almacenado correctamente.");
      await fetchFiles();
    } catch (error) {
      setMessage(error.message ?? "Error durante el proceso de cifrado.");
    } finally {
      setWorking(false);
    }
  };

  const handleDownloadFromServer = async (fileId) => {
    if (!user || !user.privateKeyCryptoKey) {
      setMessage("Debes desbloquear tu clave privada antes de descargar.");
      return;
    }
    setWorking(true);
    try {
      const response = await fetch(`${API_BASE}/files/${fileId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("No se pudo recuperar el documento cifrado.");
      }
      const payload = await response.json();
      const aesRawBase64 = await decryptAesKeyWithPrivateKey(payload.ekOwner, user.privateKeyCryptoKey);
      const aesKey = await importAesKeyFromRawBase64(aesRawBase64);
      const fileBuf = await decryptFileWithAesGcm(payload.ciphertext, payload.aeadNonce, aesKey);

      // Verify signature if present
      if (payload.signature && payload.ownerPublicKey) {
        console.log("Verifying signature in Dashboard...");
        try {
          const { sha256Base64, importPublicKeyForVerification, verifySignature } = await import("../utils/fileCryptoUtils");
          const hash = await sha256Base64(fileBuf);
          const verifyKey = await importPublicKeyForVerification(payload.ownerPublicKey);
          const isValid = await verifySignature(hash, payload.signature, verifyKey);
          console.log("Signature valid:", isValid);
          if (!isValid) {
            setErrorPopup({
              title: "Error de Integridad",
              message: "No se puede proceder con la descarga. El archivo ha sido corrompido o modificado."
            });
            setWorking(false);
            return;
          }
        } catch (verifyError) {
          console.error("Signature verification error:", verifyError);
          setErrorPopup({
            title: "Error de Verificación",
            message: "Error al verificar la firma digital del documento."
          });
          setWorking(false);
          return;
        }
      }

      const mimeType = payload.meta?.mimeType ?? "application/octet-stream";
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([fileBuf], { type: mimeType }));
      link.download = payload.meta?.originalName ?? payload.filename ?? "documento_descifrado";
      link.click();
      setMessage("Documento descifrado y descargado correctamente.");
    } catch (error) {
      setMessage(error.message ?? "No fue posible descargar el documento.");
    } finally {
      setWorking(false);
    }
  };



  return (
    <div className="flex flex-col items-center p-10">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl p-8 border border-indigo-100 space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <ShieldIcon className="text-indigo-600" size={32} />
            <h1 className="text-2xl font-bold text-gray-800">Mi Boveda de Documentos</h1>
          </div>

        </div>

        {user && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-gray-700">
            Sesion activa como <strong>{user.username}</strong>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-300 rounded-2xl p-6 hover:bg-indigo-50 transition">
            <UploadIcon size={40} className="text-indigo-500 mb-3" />
            <input
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-700 cursor-pointer"
            />
          </div>

          {/* Share with Team checkbox - only shown if user belongs to a project */}
          {userProject && (
            <label className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-100 transition">
              <input
                type="checkbox"
                checked={shareWithTeam}
                onChange={(e) => setShareWithTeam(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-blue-800">
                🔗 Compartir con mi equipo ({userProject.name})
              </span>
            </label>
          )}

          <div className="flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={handleEncrypt}
              disabled={working}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow hover:bg-indigo-700 transition disabled:opacity-60"
            >
              <UploadIcon size={18} /> {shareWithTeam ? "Cifrar y compartir" : "Cifrar y subir"}
            </button>
            <button
              type="button"
              onClick={() => fetchFiles()}
              disabled={loadingFiles}
              className="px-4 py-3 rounded-xl border border-indigo-200 text-indigo-600 font-semibold hover:bg-indigo-50 transition disabled:opacity-60"
            >
              {loadingFiles ? "Actualizando..." : "Actualizar lista"}
            </button>
          </div>
        </div>

        {message && <p className="text-center text-sm text-gray-700">{message}</p>}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Documentos almacenados</h2>
          {filesStored.length === 0 ? (
            <p className="text-sm text-gray-600">
              {loadingFiles ? "Cargando..." : "Todavia no has subido documentos cifrados."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-xl text-sm">
                <thead className="bg-indigo-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Nombre</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Tamano (bytes)</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Fecha</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filesStored.map((item) => (
                    <tr key={item.id} className="border-t border-gray-200">
                      <td className="px-4 py-2 text-gray-800">{item.filename}</td>
                      <td className="px-4 py-2 text-gray-600">{item.sizeBytes}</td>
                      <td className="px-4 py-2 text-gray-600">{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadFromServer(item.id)}
                          className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-xs"
                          disabled={working}
                        >
                          <DownloadIcon size={14} /> Descargar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Error Popup Modal */}
      {errorPopup && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "white",
            borderRadius: "12px",
            padding: "32px",
            maxWidth: "400px",
            textAlign: "center",
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)"
          }}>
            <div style={{
              width: "64px",
              height: "64px",
              background: "#fee2e2",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px"
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: "600", color: "#dc2626", marginBottom: "12px" }}>
              {errorPopup.title}
            </h3>
            <p style={{ fontSize: "14px", color: "#666", marginBottom: "24px", lineHeight: "1.5" }}>
              {errorPopup.message}
            </p>
            <button
              onClick={() => setErrorPopup(null)}
              style={{
                padding: "12px 32px",
                background: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer"
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
