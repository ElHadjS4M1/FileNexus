import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api/auth.api";
import {
    importAesKeyFromRawBase64,
    decryptAesKeyWithPrivateKey,
    decryptFileWithAesGcm,
    sha256Base64,
    importPublicKeyForVerification,
    verifySignature,
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
    const [errorPopup, setErrorPopup] = useState(null); // For signature error popup

    // Search, sort, pagination state
    const [searchQuery, setSearchQuery] = useState("");
    const [sortField, setSortField] = useState("createdAt");
    const [sortDirection, setSortDirection] = useState("desc");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

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

                {/* Search and Refresh */}
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
                    }}
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
        </div>
    );
}
