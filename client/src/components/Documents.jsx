import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api/auth.api";
import {
    importAesKeyFromRawBase64,
    decryptAesKeyWithPrivateKey,
    decryptFileWithAesGcm,
    sha256Base64,
    importPublicKeyForVerification,
    verifySignature,
    encryptFileWithAesGcm,
    exportAesKeyRawBase64,
    importPublicKeyFromPem,
    encryptAesKeyWithPublicKey,
    arrayBufferToBase64,
    importPrivateKeyForSigning,
    signHash,
    encryptKeyForRecipients,
} from "../utils/fileCryptoUtils";
import ShareDialog from "./ShareDialog";

export default function Documents() {
    const { user } = useAuth();
    const [message, setMessage] = useState("");
    const [working, setWorking] = useState(false);
    const [ownedFiles, setOwnedFiles] = useState([]);
    const [sharedFiles, setSharedFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [shareFile, setShareFile] = useState(null);
    const [errorPopup, setErrorPopup] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const fileInputRef = useRef(null);
    const [userProject, setUserProject] = useState(null);
    const [shareWithTeam, setShareWithTeam] = useState(false);

    // Search, sort, pagination state
    const [searchQuery, setSearchQuery] = useState("");
    const [sortField, setSortField] = useState("createdAt");
    const [sortDirection, setSortDirection] = useState("desc");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Fetch user's project (if they belong to one)
    useEffect(() => {
        if (!user) {
            setUserProject(null);
            return;
        }
        const fetchProject = async () => {
            try {
                const res = await fetch(`${API_BASE}/projects`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    if (data.projects && data.projects.length > 0) {
                        setUserProject(data.projects[0]);
                    }
                }
            } catch {
                // ignore
            }
        };
        fetchProject();
    }, [user]);

    const fetchFiles = useCallback(async () => {
        if (!user) {
            setOwnedFiles([]);
            setSharedFiles([]);
            return;
        }
        setLoading(true);
        try {
            const [ownedRes, sharedRes] = await Promise.all([
                fetch(`${API_BASE}/files`, { credentials: "include" }),
                fetch(`${API_BASE}/files/shared/with-me`, { credentials: "include" })
            ]);

            if (ownedRes.ok) {
                const data = await ownedRes.json();
                setOwnedFiles((data.files ?? []).map(f => ({ ...f, isShared: false })));
            }
            if (sharedRes.ok) {
                const data = await sharedRes.json();
                setSharedFiles((data.files ?? []).map(f => ({ ...f, isShared: true })));
            }
        } catch (error) {
            setMessage(error.message ?? "Error al cargar los documentos.");
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchFiles().catch(() => undefined);
    }, [fetchFiles]);

    // Handle file upload with encryption
    const handleUpload = async () => {
        if (!uploadFile) {
            setMessage("Selecciona un archivo primero.");
            return;
        }
        if (!user || !user.publicKeyPEM) {
            setMessage("Debes tener claves inicializadas.");
            return;
        }
        setWorking(true);
        try {
            const meta = await encryptFileWithAesGcm(uploadFile);
            const aesRaw = await exportAesKeyRawBase64(meta.aesKey);
            const publicKey = await importPublicKeyFromPem(user.publicKeyPEM);
            const wrappedKey = await encryptAesKeyWithPublicKey(aesRaw, publicKey);
            const fileBuffer = await uploadFile.arrayBuffer();
            const hashC = await sha256Base64(fileBuffer);

            // Sign the hash with private key
            let signatureBase64 = null;
            if (user.privateKeyPkcs8Base64) {
                const signingKey = await importPrivateKeyForSigning(user.privateKeyPkcs8Base64);
                signatureBase64 = await signHash(hashC, signingKey);
            }

            const ciphertextBlob = new Blob([meta.ciphertext], { type: "application/octet-stream" });
            const formData = new FormData();
            formData.append("ciphertext", ciphertextBlob, `${uploadFile.name}.enc`);
            formData.append("filename", uploadFile.name);
            formData.append("sizeBytes", String(uploadFile.size));
            formData.append("aeadNonce", arrayBufferToBase64(meta.iv.buffer));
            formData.append("ekOwner", wrappedKey);
            formData.append("hashC", hashC);
            if (signatureBase64) {
                formData.append("signature", signatureBase64);
            }

            // Handle team sharing
            let encryptedKeysForTeam = [];
            if (shareWithTeam && userProject) {
                try {
                    const keysRes = await fetch(`${API_BASE}/projects/${userProject.id}/members/keys`, {
                        credentials: "include",
                    });
                    if (keysRes.ok) {
                        const keysData = await keysRes.json();
                        if (keysData.recipients && keysData.recipients.length > 0) {
                            encryptedKeysForTeam = await encryptKeyForRecipients(aesRaw, keysData.recipients);
                        }
                    }
                } catch (teamErr) {
                    console.error("Error sharing with team:", teamErr);
                }
                formData.append("projectId", userProject.id);
                formData.append("encryptedKeys", JSON.stringify(encryptedKeysForTeam));
            }

            formData.append("meta", JSON.stringify({
                mimeType: meta.mimeType,
                originalName: uploadFile.name,
                recipients: [{ id: user.username, encryptedAesKeyBase64: wrappedKey, publicKeyPEM: user.publicKeyPEM }],
            }));

            const response = await fetch(`${API_BASE}/files`, {
                method: "POST",
                credentials: "include",
                body: formData,
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error ?? "Error al subir el documento.");
            }

            setUploadFile(null);
            setShareWithTeam(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
            setMessage(shareWithTeam ? "Documento compartido con el equipo." : "Documento cifrado y subido correctamente.");
            await fetchFiles();
        } catch (error) {
            setMessage(error.message ?? "Error durante la subida.");
        } finally {
            setWorking(false);
        }
    };

    // Combine and process files
    const allFiles = useMemo(() => {
        const combined = [...ownedFiles, ...sharedFiles];

        // Filter by search
        const filtered = combined.filter(file => {
            const query = searchQuery.toLowerCase();
            const filename = file.filename?.toLowerCase() || "";
            const owner = file.ownerUsername?.toLowerCase() || "";
            return filename.includes(query) || owner.includes(query);
        });

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            let aVal, bVal;
            if (sortField === "filename") {
                aVal = a.filename?.toLowerCase() || "";
                bVal = b.filename?.toLowerCase() || "";
            } else if (sortField === "ownerUsername") {
                aVal = a.ownerUsername?.toLowerCase() || "";
                bVal = b.ownerUsername?.toLowerCase() || "";
            } else if (sortField === "createdAt") {
                aVal = new Date(a.sharedAt || a.createdAt).getTime();
                bVal = new Date(b.sharedAt || b.createdAt).getTime();
            } else {
                aVal = a[sortField];
                bVal = b[sortField];
            }

            if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
            if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
            return 0;
        });

        return sorted;
    }, [ownedFiles, sharedFiles, searchQuery, sortField, sortDirection]);

    // Pagination
    const totalPages = Math.ceil(allFiles.length / itemsPerPage);
    const paginatedFiles = allFiles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    const handleDownload = async (file) => {
        if (!user || !user.privateKeyCryptoKey) {
            setMessage("Debes desbloquear tu clave privada antes de descargar.");
            return;
        }
        setWorking(true);
        try {
            const url = file.isShared ? `${API_BASE}/files/shared/${file.id}` : `${API_BASE}/files/${file.id}`;
            const response = await fetch(url, { credentials: "include" });
            if (!response.ok) throw new Error("No se pudo recuperar el documento.");

            const payload = await response.json();
            console.log("Server response payload keys:", Object.keys(payload));
            console.log("payload.signature:", payload.signature ? "present" : "missing");
            console.log("payload.ownerPublicKey:", payload.ownerPublicKey ? "present" : "missing");
            const encKey = file.isShared ? payload.encryptedKey : payload.ekOwner;
            const aesRawBase64 = await decryptAesKeyWithPrivateKey(encKey, user.privateKeyCryptoKey);
            const aesKey = await importAesKeyFromRawBase64(aesRawBase64);
            const fileBuf = await decryptFileWithAesGcm(payload.ciphertext, payload.aeadNonce, aesKey);

            // Verify signature if present
            if (payload.signature && payload.ownerPublicKey) {
                console.log("Verifying signature...");
                try {
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
            } else {
                console.log("No signature present, skipping verification. signature:", payload.signature, "ownerPublicKey:", payload.ownerPublicKey);
            }

            const link = document.createElement("a");
            link.href = URL.createObjectURL(new Blob([fileBuf], { type: payload.meta?.mimeType || "application/octet-stream" }));
            link.download = payload.meta?.originalName || payload.filename || "documento";
            link.click();
            setMessage("Documento descargado correctamente.");
        } catch (error) {
            setMessage(error.message || "Error al descargar.");
        } finally {
            setWorking(false);
        }
    };

    // Share existing file with team
    const handleShareWithTeam = async (file) => {
        if (!user || !user.privateKeyCryptoKey || !userProject) {
            setMessage("Debes tener el proyecto y clave privada para compartir.");
            return;
        }
        setWorking(true);
        try {
            // 1. Get the file's encrypted key (ekOwner)
            const fileRes = await fetch(`${API_BASE}/files/${file.id}`, { credentials: "include" });
            if (!fileRes.ok) throw new Error("No se pudo obtener el archivo.");
            const payload = await fileRes.json();

            // 2. Decrypt the AES key with user's private key
            const aesRawBase64 = await decryptAesKeyWithPrivateKey(payload.ekOwner, user.privateKeyCryptoKey);

            // 3. Get team members' public keys
            const keysRes = await fetch(`${API_BASE}/projects/${userProject.id}/members/keys`, { credentials: "include" });
            if (!keysRes.ok) throw new Error("No se pudieron obtener las claves del equipo.");
            const keysData = await keysRes.json();

            // 4. Encrypt the AES key for each team member
            const encryptedKeys = await encryptKeyForRecipients(aesRawBase64, keysData.recipients || []);

            // 5. Send to server
            const shareRes = await fetch(`${API_BASE}/files/${file.id}/share-with-team`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId: userProject.id,
                    encryptedKeys,
                }),
            });
            if (!shareRes.ok) throw new Error("Error al compartir con el equipo.");

            const result = await shareRes.json();
            setMessage(`Documento compartido con ${result.sharesCreated} miembros del equipo.`);
            await fetchFiles();
        } catch (error) {
            setMessage(error.message || "Error al compartir con el equipo.");
        } finally {
            setWorking(false);
        }
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const SortIcon = ({ field }) => (
        <span style={{ marginLeft: "4px", opacity: sortField === field ? 1 : 0.3 }}>
            {sortField === field && sortDirection === "asc" ? "▲" : "▼"}
        </span>
    );

    return (
        <div style={{ padding: "32px" }}>
            <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
                {/* Header */}
                <div style={{ marginBottom: "24px" }}>
                    <h1 style={{ fontSize: "24px", fontWeight: "600", color: "#1a1a1a", marginBottom: "8px" }}>
                        Mis documentos
                    </h1>
                    <p style={{ color: "#666", fontSize: "14px" }}>
                        Todos tus documentos cifrados en un solo lugar
                    </p>
                </div>

                {message && (
                    <p style={{ marginBottom: "16px", fontSize: "14px", color: message.includes("correctamente") ? "#16a34a" : "#666" }}>
                        {message}
                    </p>
                )}

                {/* Search, Upload and Refresh */}
                <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
                    <div style={{ position: "relative", flex: 1 }}>
                        <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <path d="m21 21-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o propietario..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "10px 12px 10px 40px",
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                fontSize: "14px"
                            }}
                        />
                    </div>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "10px 16px",
                            background: "#0a6ed1",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "14px",
                            fontWeight: "500",
                            cursor: "pointer"
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Subir
                    </button>
                    <button
                        onClick={() => fetchFiles()}
                        disabled={loading}
                        style={{
                            padding: "10px 20px",
                            background: "#f5f5f5",
                            border: "1px solid #ddd",
                            borderRadius: "8px",
                            fontSize: "14px",
                            cursor: "pointer"
                        }}
                    >
                        {loading ? "Cargando..." : "Actualizar"}
                    </button>
                </div>

                {/* Documents Table */}
                <div style={{ background: "white", borderRadius: "12px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                    <div style={{ padding: "16px 24px", borderBottom: "1px solid #eee" }}>
                        <span style={{ fontSize: "14px", color: "#666" }}>
                            {allFiles.length} documento{allFiles.length !== 1 ? "s" : ""} encontrado{allFiles.length !== 1 ? "s" : ""}
                        </span>
                    </div>

                    {paginatedFiles.length === 0 ? (
                        <div style={{ padding: "48px", textAlign: "center", color: "#888" }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" style={{ margin: "0 auto 16px" }}>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <p style={{ fontSize: "14px" }}>
                                {loading ? "Cargando..." : searchQuery ? "No se encontraron documentos" : "No tienes documentos"}
                            </p>
                        </div>
                    ) : (
                        <>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr style={{ background: "#fafafa" }}>
                                        <th onClick={() => handleSort("filename")} style={{ padding: "12px 24px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", cursor: "pointer", userSelect: "none" }}>
                                            Nombre <SortIcon field="filename" />
                                        </th>
                                        <th onClick={() => handleSort("ownerUsername")} style={{ padding: "12px 24px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", cursor: "pointer", userSelect: "none" }}>
                                            Propietario <SortIcon field="ownerUsername" />
                                        </th>
                                        <th style={{ padding: "12px 24px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                            Tamaño
                                        </th>
                                        <th onClick={() => handleSort("createdAt")} style={{ padding: "12px 24px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", cursor: "pointer", userSelect: "none" }}>
                                            Fecha <SortIcon field="createdAt" />
                                        </th>
                                        <th style={{ padding: "12px 24px", textAlign: "right", fontSize: "12px", fontWeight: "600", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedFiles.map((item) => (
                                        <tr key={`${item.id}-${item.isShared}`} style={{ borderTop: "1px solid #eee" }}>
                                            <td style={{ padding: "16px 24px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                                                    <div style={{
                                                        width: "36px",
                                                        height: "36px",
                                                        background: item.isShared ? "#fef3c7" : "#e8f4fd",
                                                        borderRadius: "8px",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center"
                                                    }}>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={item.isShared ? "#d97706" : "#0a6ed1"} strokeWidth="2">
                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                            <polyline points="14 2 14 8 20 8" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <span style={{ fontSize: "14px", fontWeight: "500", color: "#1a1a1a" }}>{item.filename}</span>
                                                        {item.isShared && (
                                                            <span style={{ marginLeft: "8px", fontSize: "11px", background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: "4px" }}>
                                                                Compartido
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: "16px 24px", fontSize: "14px", color: "#666" }}>{item.ownerUsername}</td>
                                            <td style={{ padding: "16px 24px", fontSize: "14px", color: "#666" }}>{formatBytes(item.sizeBytes)}</td>
                                            <td style={{ padding: "16px 24px", fontSize: "14px", color: "#666" }}>
                                                {new Date(item.sharedAt || item.createdAt).toLocaleString()}
                                            </td>
                                            <td style={{ padding: "16px 24px", textAlign: "right" }}>
                                                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                                                    {!item.isShared && (
                                                        <button
                                                            onClick={() => setShareFile(item)}
                                                            style={{
                                                                padding: "8px 16px",
                                                                background: "#0a6ed1",
                                                                color: "white",
                                                                border: "none",
                                                                borderRadius: "6px",
                                                                fontSize: "13px",
                                                                fontWeight: "500",
                                                                cursor: "pointer"
                                                            }}
                                                        >
                                                            Compartir
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDownload(item)}
                                                        disabled={working}
                                                        style={{
                                                            padding: "8px 16px",
                                                            background: "#16a34a",
                                                            color: "white",
                                                            border: "none",
                                                            borderRadius: "6px",
                                                            fontSize: "13px",
                                                            fontWeight: "500",
                                                            cursor: working ? "not-allowed" : "pointer"
                                                        }}
                                                    >
                                                        Descargar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div style={{ padding: "16px 24px", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: "14px", color: "#666" }}>
                                        Página {currentPage} de {totalPages}
                                    </span>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            style={{
                                                padding: "8px 16px",
                                                background: currentPage === 1 ? "#f5f5f5" : "white",
                                                border: "1px solid #ddd",
                                                borderRadius: "6px",
                                                fontSize: "13px",
                                                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                                                color: currentPage === 1 ? "#999" : "#333"
                                            }}
                                        >
                                            Anterior
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            style={{
                                                padding: "8px 16px",
                                                background: currentPage === totalPages ? "#f5f5f5" : "white",
                                                border: "1px solid #ddd",
                                                borderRadius: "6px",
                                                fontSize: "13px",
                                                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                                                color: currentPage === totalPages ? "#999" : "#333"
                                            }}
                                        >
                                            Siguiente
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {shareFile && (
                <ShareDialog
                    file={shareFile}
                    onClose={() => setShareFile(null)}
                    onShare={(sharedUser) => {
                        setMessage(`Documento compartido con ${sharedUser.username}`);
                        setShareFile(null);
                        fetchFiles();
                    }}
                    userProject={userProject}
                />
            )}

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

            {/* Upload Modal */}
            {showUploadModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                    <div style={{ background: "white", borderRadius: "16px", padding: "32px", width: "450px", textAlign: "center" }}>
                        <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px" }}>Subir Documento</h3>
                        <p style={{ fontSize: "14px", color: "#666", marginBottom: "24px" }}>
                            El archivo será cifrado y firmado automáticamente.
                        </p>
                        <div style={{ padding: "24px", border: "2px dashed #ddd", borderRadius: "12px", marginBottom: "16px", background: "#f9fafb" }}>
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                style={{ width: "100%" }}
                            />
                            {uploadFile && (
                                <p style={{ marginTop: "12px", fontSize: "14px", color: "#0a6ed1", fontWeight: "500" }}>
                                    Archivo seleccionado: {uploadFile.name}
                                </p>
                            )}
                        </div>

                        {/* Team sharing checkbox */}
                        {userProject && (
                            <label style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                padding: "16px",
                                background: shareWithTeam ? "#dbeafe" : "#f0fdf4",
                                border: shareWithTeam ? "1px solid #3b82f6" : "1px solid #86efac",
                                borderRadius: "12px",
                                marginBottom: "24px",
                                cursor: "pointer",
                                transition: "all 0.2s"
                            }}>
                                <input
                                    type="checkbox"
                                    checked={shareWithTeam}
                                    onChange={(e) => setShareWithTeam(e.target.checked)}
                                    style={{ width: "20px", height: "20px" }}
                                />
                                <div style={{ textAlign: "left" }}>
                                    <div style={{ fontSize: "14px", fontWeight: "600", color: shareWithTeam ? "#1d4ed8" : "#166534" }}>
                                        🔗 Compartir con mi equipo
                                    </div>
                                    <div style={{ fontSize: "12px", color: "#666" }}>
                                        Proyecto: {userProject.name}
                                    </div>
                                </div>
                            </label>
                        )}

                        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                            <button
                                onClick={() => { setShowUploadModal(false); setUploadFile(null); setShareWithTeam(false); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                style={{ padding: "12px 24px", background: "#f3f4f6", border: "none", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={async () => { await handleUpload(); setShowUploadModal(false); }}
                                disabled={!uploadFile || working}
                                style={{
                                    padding: "12px 24px",
                                    background: uploadFile && !working ? (shareWithTeam ? "#3b82f6" : "#0a6ed1") : "#d1d5db",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontSize: "14px",
                                    fontWeight: "500",
                                    cursor: uploadFile && !working ? "pointer" : "not-allowed"
                                }}
                            >
                                {working ? "Subiendo..." : (shareWithTeam ? "Compartir" : "Subir")}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
