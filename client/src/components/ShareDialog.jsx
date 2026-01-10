import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api/auth.api";
import {
    decryptAesKeyWithPrivateKey,
    encryptAesKeyWithPublicKey,
    importPublicKeyFromJwk,
    encryptKeyForRecipients,
} from "../utils/fileCryptoUtils";

export default function ShareDialog({ file, onClose, onShare, userProject }) {
    const { user } = useAuth();
    const [step, setStep] = useState("search");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const search = async () => {
            if (searchQuery.length < 2) {
                setSearchResults([]);
                return;
            }
            try {
                const res = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(searchQuery)}`, {
                    credentials: "include",
                });
                if (res.ok) {
                    const data = await res.json();
                    setSearchResults(data.users || []);
                }
            } catch (err) {
                console.error("Search error:", err);
            }
        };
        const timer = setTimeout(search, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSelectUser = (u) => {
        setSelectedUser(u);
        setStep("confirm");
    };

    const handleShareWithTeam = async () => {
        if (!user?.privateKeyCryptoKey || !userProject) return;
        setLoading(true);
        setError("");
        try {
            const fileRes = await fetch(`${API_BASE}/files/${file.id}`, { credentials: "include" });
            if (!fileRes.ok) throw new Error("No se pudo obtener el archivo.");
            const payload = await fileRes.json();
            const aesRawBase64 = await decryptAesKeyWithPrivateKey(payload.ekOwner, user.privateKeyCryptoKey);
            const keysRes = await fetch(`${API_BASE}/projects/${userProject.id}/members/keys`, { credentials: "include" });
            if (!keysRes.ok) throw new Error("No se pudieron obtener las claves del equipo.");
            const keysData = await keysRes.json();
            const encryptedKeys = await encryptKeyForRecipients(aesRawBase64, keysData.recipients || []);
            const shareRes = await fetch(`${API_BASE}/files/${file.id}/share-with-team`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId: userProject.id, encryptedKeys }),
            });
            if (!shareRes.ok) throw new Error("Error al compartir con el equipo.");
            const result = await shareRes.json();
            onShare?.({ username: `${result.sharesCreated} miembros del equipo` });
            onClose();
        } catch (err) {
            setError(err.message || "Error al compartir con el equipo.");
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (!selectedUser || !user?.privateKeyCryptoKey) {
            setError("No se pudo compartir. Verifica tu sesión.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const pubKeyRes = await fetch(`${API_BASE}/users/${selectedUser.id}/publicKey`, { credentials: "include" });
            if (!pubKeyRes.ok) throw new Error("No se pudo obtener la clave pública del destinatario.");
            const { publicKeyJwk } = await pubKeyRes.json();
            const fileRes = await fetch(`${API_BASE}/files/${file.id}`, { credentials: "include" });
            if (!fileRes.ok) throw new Error("No se pudo obtener el fichero.");
            const fileData = await fileRes.json();
            const aesKeyBase64 = await decryptAesKeyWithPrivateKey(fileData.ekOwner, user.privateKeyCryptoKey);
            const recipientPubKey = await importPublicKeyFromJwk(publicKeyJwk);
            const encryptedKeyForRecipient = await encryptAesKeyWithPublicKey(aesKeyBase64, recipientPubKey);
            const shareRes = await fetch(`${API_BASE}/files/${file.id}/share`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: selectedUser.id, encryptedKey: encryptedKeyForRecipient }),
            });
            if (!shareRes.ok) {
                const errData = await shareRes.json().catch(() => ({}));
                throw new Error(errData.error || "Error al compartir el fichero.");
            }
            onShare?.(selectedUser);
            onClose();
        } catch (err) {
            setError(err.message || "Error al compartir.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "white", borderRadius: "12px", width: "100%", maxWidth: "480px", maxHeight: "80vh", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
                <div style={{ padding: "20px 24px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#333", margin: 0 }}>Compartir documento</h2>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "#999", lineHeight: 1 }}>×</button>
                </div>
                <div style={{ padding: "24px" }}>
                    {step === "search" && (
                        <>
                            <p style={{ fontSize: "14px", color: "#666", marginBottom: "16px" }}>
                                Archivo: <strong>{file.filename}</strong>
                            </p>
                            {userProject && (
                                <button
                                    onClick={handleShareWithTeam}
                                    disabled={loading}
                                    style={{ width: "100%", padding: "16px", marginBottom: "16px", background: loading ? "#e0e7ff" : "#eef2ff", border: "2px solid #818cf8", borderRadius: "10px", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "12px" }}
                                >
                                    <div style={{ width: "40px", height: "40px", background: "#7c3aed", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>👥</div>
                                    <div style={{ textAlign: "left" }}>
                                        <div style={{ fontWeight: "600", color: "#4f46e5", fontSize: "14px" }}>{loading ? "Compartiendo..." : "Compartir con mi equipo"}</div>
                                        <div style={{ fontSize: "12px", color: "#6366f1" }}>{userProject.name}</div>
                                    </div>
                                </button>
                            )}
                            {error && <p style={{ color: "#dc2626", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}
                            <div style={{ borderTop: userProject ? "1px solid #eee" : "none", paddingTop: userProject ? "16px" : "0" }}>
                                <p style={{ fontSize: "13px", color: "#888", marginBottom: "8px" }}>O buscar un usuario específico:</p>
                                <input
                                    type="text"
                                    placeholder="Buscar usuario por nombre..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ width: "100%", padding: "12px 16px", border: "1px solid #ddd", borderRadius: "8px", fontSize: "14px", marginBottom: "16px" }}
                                />
                            </div>
                            <div style={{ maxHeight: "200px", overflow: "auto" }}>
                                {searchResults.length === 0 && searchQuery.length >= 2 && (
                                    <p style={{ color: "#999", fontSize: "14px", textAlign: "center", padding: "20px" }}>No se encontraron usuarios</p>
                                )}
                                {searchResults.map((u) => (
                                    <button
                                        key={u.id}
                                        onClick={() => handleSelectUser(u)}
                                        style={{ width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", background: "none", border: "1px solid #eee", borderRadius: "8px", marginBottom: "8px", cursor: "pointer", textAlign: "left" }}
                                    >
                                        <div style={{ width: "36px", height: "36px", background: "#0a6ed1", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "600" }}>
                                            {u.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: "500", color: "#333" }}>{u.username}</div>
                                            <div style={{ fontSize: "12px", color: "#999" }}>{u.role}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                    {step === "confirm" && selectedUser && (
                        <>
                            <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "20px", textAlign: "center" }}>
                                <p style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>¿Compartir el documento</p>
                                <p style={{ fontSize: "16px", fontWeight: "600", color: "#333", marginBottom: "8px" }}>"{file.filename}"</p>
                                <p style={{ fontSize: "14px", color: "#666", marginBottom: "8px" }}>con el usuario</p>
                                <p style={{ fontSize: "16px", fontWeight: "600", color: "#0a6ed1" }}>{selectedUser.username}</p>
                            </div>
                            {error && <p style={{ color: "#dc2626", fontSize: "14px", marginBottom: "16px", textAlign: "center" }}>{error}</p>}
                            <div style={{ display: "flex", gap: "12px" }}>
                                <button onClick={() => { setStep("search"); setSelectedUser(null); }} style={{ flex: 1, padding: "12px", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: "8px", fontSize: "14px", cursor: "pointer" }}>Cancelar</button>
                                <button onClick={handleShare} disabled={loading} style={{ flex: 1, padding: "12px", background: loading ? "#ccc" : "#0a6ed1", color: "white", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "500", cursor: loading ? "not-allowed" : "pointer" }}>{loading ? "Compartiendo..." : "Confirmar"}</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
