import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { API_BASE } from "../api/auth.api";
import {
    decryptAesKeyWithPrivateKey,
    encryptAesKeyWithPublicKey,
    importPublicKeyFromJwk,
    encryptKeyForRecipients,
} from "../utils/fileCryptoUtils";

// Icons
const UsersIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

const FileIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
);

const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

export default function Team() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");

    // Data
    const [departments, setDepartments] = useState([]);
    const [myDepartment, setMyDepartment] = useState(null);
    const [myProject, setMyProject] = useState(null);
    const [projectFiles, setProjectFiles] = useState([]);

    // Modals
    const [showCreateDepartment, setShowCreateDepartment] = useState(false);
    const [showEditDepartment, setShowEditDepartment] = useState(null);
    const [showCreateProject, setShowCreateProject] = useState(false);
    const [showEditProject, setShowEditProject] = useState(null);
    const [showAddMember, setShowAddMember] = useState(false);

    // Form state
    const [newDeptName, setNewDeptName] = useState("");
    const [newDeptManager, setNewDeptManager] = useState("");
    const [editDeptManager, setEditDeptManager] = useState("");
    const [newProjectName, setNewProjectName] = useState("");
    const [newProjectLeader, setNewProjectLeader] = useState("");
    const [editProjectLeader, setEditProjectLeader] = useState("");
    const [deptHeads, setDeptHeads] = useState([]);
    const [projectHeads, setProjectHeads] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [memberSearch, setMemberSearch] = useState("");

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            if (user.role === "admin") {
                const res = await fetch(`${API_BASE}/departments`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    setDepartments(data.departments || []);
                }
            } else if (user.role === "dept_head") {
                const res = await fetch(`${API_BASE}/departments`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    if (data.departments && data.departments.length > 0) {
                        setMyDepartment(data.departments[0]);
                        // Fetch projects in department
                        const projRes = await fetch(`${API_BASE}/projects`, { credentials: "include" });
                        if (projRes.ok) {
                            const projData = await projRes.json();
                            setMyDepartment(prev => ({ ...prev, projects: projData.projects || [] }));
                        }
                    }
                }
            } else if (user.role === "project_head") {
                const res = await fetch(`${API_BASE}/projects`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    if (data.projects && data.projects.length > 0) {
                        const projectId = data.projects[0].id;
                        // Fetch full project details
                        const detailRes = await fetch(`${API_BASE}/projects/${projectId}`, { credentials: "include" });
                        if (detailRes.ok) {
                            const detail = await detailRes.json();
                            setMyProject(detail);
                        }
                        // Fetch project files
                        const filesRes = await fetch(`${API_BASE}/files?projectId=${projectId}`, { credentials: "include" });
                        if (filesRes.ok) {
                            const filesData = await filesRes.json();
                            setProjectFiles((filesData.files || []).slice(0, 5));
                        }
                    }
                }
            } else {
                // Regular user - fetch projects they are member of
                const res = await fetch(`${API_BASE}/projects`, { credentials: "include" });
                if (res.ok) {
                    const data = await res.json();
                    if (data.projects && data.projects.length > 0) {
                        const projectId = data.projects[0].id;
                        // Fetch full project details
                        const detailRes = await fetch(`${API_BASE}/projects/${projectId}`, { credentials: "include" });
                        if (detailRes.ok) {
                            const detail = await detailRes.json();
                            setMyProject(detail);
                        }
                        // Fetch files shared through this project only (not individual shares)
                        const sharedRes = await fetch(`${API_BASE}/files/shared/project/${projectId}`, { credentials: "include" });
                        if (sharedRes.ok) {
                            const sharedData = await sharedRes.json();
                            setProjectFiles((sharedData.files || []).slice(0, 5));
                        }
                    }
                }
            }
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Search functions with unassigned filter
    const searchUnassignedDeptHeads = async () => {
        try {
            const res = await fetch(`${API_BASE}/users/search?q=&role=dept_head&unassigned=true`, { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setDeptHeads(data.users || []);
            }
        } catch { /* ignore */ }
    };

    const searchUnassignedProjectHeads = async () => {
        try {
            const res = await fetch(`${API_BASE}/users/search?q=&role=project_head&unassigned=true`, { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setProjectHeads(data.users || []);
            }
        } catch { /* ignore */ }
    };

    const searchUsers = async (query) => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}&role=user`, { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data.users || []);
            }
        } catch { /* ignore */ }
    };

    // Handlers
    const handleCreateDepartment = async () => {
        if (!newDeptName) return;
        try {
            const body = { name: newDeptName };
            if (newDeptManager) body.managerId = newDeptManager;
            const res = await fetch(`${API_BASE}/departments`, {
                method: "POST", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Error");
            setShowCreateDepartment(false);
            setNewDeptName("");
            setNewDeptManager("");
            fetchData();
            setMessage("Departamento creado");
        } catch (e) { setMessage(e.message); }
    };

    const handleAssignDeptManager = async () => {
        if (!showEditDepartment || !editDeptManager) return;
        try {
            const res = await fetch(`${API_BASE}/departments/${showEditDepartment.id}`, {
                method: "PATCH", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ managerId: editDeptManager }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Error");
            setShowEditDepartment(null);
            setEditDeptManager("");
            fetchData();
            setMessage("Jefe asignado");
        } catch (e) { setMessage(e.message); }
    };

    const handleCreateProject = async () => {
        if (!newProjectName || !myDepartment) return;
        try {
            const body = {
                name: newProjectName,
                departmentId: myDepartment.id,
            };
            if (newProjectLeader) body.leaderId = newProjectLeader;
            const res = await fetch(`${API_BASE}/projects`, {
                method: "POST", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Error");
            setShowCreateProject(false);
            setNewProjectName("");
            setNewProjectLeader("");
            fetchData();
            setMessage("Proyecto creado");
        } catch (e) { setMessage(e.message); }
    };

    const handleAssignProjectLeader = async () => {
        if (!showEditProject || !editProjectLeader) return;
        try {
            const res = await fetch(`${API_BASE}/projects/${showEditProject.id}`, {
                method: "PATCH", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leaderId: editProjectLeader }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Error");
            setShowEditProject(null);
            setEditProjectLeader("");
            fetchData();
            setMessage("Líder asignado");
        } catch (e) { setMessage(e.message); }
    };

    const handleAddMember = async (userId) => {
        if (!myProject || !user?.privateKeyCryptoKey) return;
        try {
            // 1. Add member to project
            const res = await fetch(`${API_BASE}/projects/${myProject.id}/members`, {
                method: "POST", credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Error al añadir miembro");

            setMessage("Miembro añadido. Compartiendo archivos del proyecto...");

            // 2. Get new member's public key
            const keyRes = await fetch(`${API_BASE}/users/${userId}/publicKey`, { credentials: "include" });
            if (!keyRes.ok) throw new Error("No se pudo obtener la clave del usuario");
            const { publicKeyJwk } = await keyRes.json();
            const recipientPubKey = await importPublicKeyFromJwk(publicKeyJwk);

            // 3. Get all project files
            const filesRes = await fetch(`${API_BASE}/files/shared/project/${myProject.id}`, { credentials: "include" });
            if (filesRes.ok) {
                const { files } = await filesRes.json();

                // 4. Share each file with the new member
                let sharedCount = 0;
                for (const file of files) {
                    try {
                        let aesRawBase64;

                        // Get file details to access the encrypted key
                        if (file.ownerUsername === user.username) {
                            // I am the owner
                            const detailRes = await fetch(`${API_BASE}/files/${file.id}`, { credentials: "include" });
                            if (!detailRes.ok) continue;
                            const detail = await detailRes.json();
                            aesRawBase64 = await decryptAesKeyWithPrivateKey(detail.ekOwner, user.privateKeyCryptoKey);
                        } else {
                            // Shared with me
                            const shareRes = await fetch(`${API_BASE}/files/shared/${file.id}`, { credentials: "include" });
                            if (!shareRes.ok) continue;
                            const share = await shareRes.json();
                            aesRawBase64 = await decryptAesKeyWithPrivateKey(share.encryptedKey, user.privateKeyCryptoKey);
                        }

                        // Encrypt for new member
                        const encryptedKey = await encryptAesKeyWithPublicKey(aesRawBase64, recipientPubKey);

                        // Share using share-with-team endpoint
                        await fetch(`${API_BASE}/files/${file.id}/share-with-team`, {
                            method: "POST",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                projectId: myProject.id,
                                encryptedKeys: [{ userId, encryptedKey }]
                            }),
                        });
                        sharedCount++;
                    } catch (err) {
                        console.error(`Error sharing file ${file.id}:`, err);
                    }
                }
                if (sharedCount > 0) {
                    setMessage(`Miembro añadido y ${sharedCount} archivos compartidos.`);
                }
            }

            setShowAddMember(false);
            setMemberSearch("");
            setSearchResults([]);
            fetchData();
        } catch (e) { setMessage(e.message); }
    };

    const handleRemoveMember = async (userId) => {
        if (!myProject) return;
        try {
            await fetch(`${API_BASE}/projects/${myProject.id}/members/${userId}`, {
                method: "DELETE", credentials: "include"
            });
            fetchData();
            setMessage("Miembro eliminado");
        } catch (e) { setMessage(e.message); }
    };

    // ========== RENDER ==========

    if (loading) {
        return <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>Cargando...</div>;
    }

    // ========== ADMIN VIEW ==========
    if (user?.role === "admin") {
        return (
            <div style={{ padding: "40px" }}>
                <div style={{ maxWidth: "900px", margin: "0 auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                        <h1 style={{ fontSize: "28px", fontWeight: "700" }}>Gestión de Departamentos</h1>
                        <button onClick={() => { setShowCreateDepartment(true); searchUnassignedDeptHeads(); }}
                            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 20px", background: "#8b5cf6", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "500" }}>
                            <PlusIcon /> Nuevo Departamento
                        </button>
                    </div>

                    {message && <div style={{ padding: "12px", background: "#ecfdf5", border: "1px solid #10b981", borderRadius: "8px", marginBottom: "16px", color: "#065f46" }}>{message}<button onClick={() => setMessage("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>×</button></div>}

                    <div style={{ background: "white", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                        {departments.length === 0 ? (
                            <p style={{ color: "#999" }}>No hay departamentos creados.</p>
                        ) : (
                            <div style={{ display: "grid", gap: "12px" }}>
                                {departments.map(dept => (
                                    <div key={dept.id} style={{ padding: "16px", background: "#f5f3ff", borderRadius: "8px", border: "1px solid #e9d5ff" }}>
                                        <div style={{ fontWeight: "600", fontSize: "16px" }}>{dept.name}</div>
                                        <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
                                            {dept.manager ? `Jefe: ${dept.manager.username}` : <span style={{ color: "#f59e0b" }}>Sin jefe asignado</span>}
                                            {" • "}{dept._count?.projects || 0} proyectos
                                        </div>
                                        {!dept.manager && (
                                            <button onClick={() => { setShowEditDepartment(dept); searchUnassignedDeptHeads(); setEditDeptManager(""); }}
                                                style={{ marginTop: "8px", padding: "6px 12px", fontSize: "12px", background: "#8b5cf6", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                                                Asignar Jefe
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Create Department Modal */}
                {showCreateDepartment && (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                        <div style={{ background: "white", borderRadius: "12px", padding: "32px", width: "400px" }}>
                            <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px" }}>Nuevo Departamento</h3>
                            <input type="text" placeholder="Nombre del departamento" value={newDeptName} onChange={e => setNewDeptName(e.target.value)}
                                style={{ width: "100%", padding: "12px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "16px", boxSizing: "border-box" }} />
                            <select value={newDeptManager} onChange={e => setNewDeptManager(e.target.value)}
                                style={{ width: "100%", padding: "12px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "20px", boxSizing: "border-box" }}>
                                <option value="">Sin jefe (asignar después)</option>
                                {deptHeads.map(dh => <option key={dh.id} value={dh.id}>{dh.username}</option>)}
                            </select>
                            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                                <button onClick={() => setShowCreateDepartment(false)} style={{ padding: "10px 20px", background: "#f3f4f6", border: "none", borderRadius: "8px", cursor: "pointer" }}>Cancelar</button>
                                <button onClick={handleCreateDepartment} style={{ padding: "10px 20px", background: "#8b5cf6", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>Crear</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Assign Manager Modal */}
                {showEditDepartment && (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                        <div style={{ background: "white", borderRadius: "12px", padding: "32px", width: "400px" }}>
                            <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px" }}>Asignar Jefe</h3>
                            <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>Departamento: <strong>{showEditDepartment.name}</strong></p>
                            <select value={editDeptManager} onChange={e => setEditDeptManager(e.target.value)}
                                style={{ width: "100%", padding: "12px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "20px", boxSizing: "border-box" }}>
                                <option value="">Seleccionar jefe</option>
                                {deptHeads.map(dh => <option key={dh.id} value={dh.id}>{dh.username}</option>)}
                            </select>
                            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                                <button onClick={() => setShowEditDepartment(null)} style={{ padding: "10px 20px", background: "#f3f4f6", border: "none", borderRadius: "8px", cursor: "pointer" }}>Cancelar</button>
                                <button onClick={handleAssignDeptManager} disabled={!editDeptManager} style={{ padding: "10px 20px", background: editDeptManager ? "#8b5cf6" : "#d1d5db", color: "white", border: "none", borderRadius: "8px", cursor: editDeptManager ? "pointer" : "not-allowed" }}>Asignar</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ========== DEPT_HEAD VIEW ==========
    if (user?.role === "dept_head") {
        return (
            <div style={{ padding: "40px" }}>
                <div style={{ maxWidth: "900px", margin: "0 auto" }}>
                    <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px" }}>
                        {myDepartment ? myDepartment.name : "Mi Departamento"}
                    </h1>
                    <p style={{ color: "#666", marginBottom: "24px" }}>Gestiona los proyectos de tu departamento</p>

                    {message && <div style={{ padding: "12px", background: "#ecfdf5", border: "1px solid #10b981", borderRadius: "8px", marginBottom: "16px", color: "#065f46" }}>{message}<button onClick={() => setMessage("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>×</button></div>}

                    {!myDepartment ? (
                        <p style={{ color: "#999" }}>No tienes un departamento asignado.</p>
                    ) : (
                        <>
                            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
                                <button onClick={() => { setShowCreateProject(true); searchUnassignedProjectHeads(); }}
                                    style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px 20px", background: "#0a6ed1", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "500" }}>
                                    <PlusIcon /> Nuevo Proyecto
                                </button>
                            </div>

                            <div style={{ background: "white", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                                <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px" }}>Proyectos</h2>
                                {(!myDepartment.projects || myDepartment.projects.length === 0) ? (
                                    <p style={{ color: "#999" }}>No hay proyectos en este departamento.</p>
                                ) : (
                                    <div style={{ display: "grid", gap: "12px" }}>
                                        {myDepartment.projects.map(proj => (
                                            <div key={proj.id} style={{ padding: "16px", background: "#f0f9ff", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                                                <div style={{ fontWeight: "600" }}>{proj.name}</div>
                                                <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
                                                    {proj.leader ? `Líder: ${proj.leader.username}` : <span style={{ color: "#f59e0b" }}>Sin líder asignado</span>} • {proj._count?.members || 0} miembros
                                                </div>
                                                {!proj.leader && (
                                                    <button onClick={() => { setShowEditProject(proj); searchUnassignedProjectHeads(); setEditProjectLeader(""); }}
                                                        style={{ marginTop: "8px", padding: "6px 12px", fontSize: "12px", background: "#0a6ed1", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" }}>
                                                        Asignar Líder
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Create Project Modal */}
                {showCreateProject && (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                        <div style={{ background: "white", borderRadius: "12px", padding: "32px", width: "400px" }}>
                            <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px" }}>Nuevo Proyecto</h3>
                            <input type="text" placeholder="Nombre del proyecto" value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
                                style={{ width: "100%", padding: "12px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "16px", boxSizing: "border-box" }} />
                            <select value={newProjectLeader} onChange={e => setNewProjectLeader(e.target.value)}
                                style={{ width: "100%", padding: "12px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "20px", boxSizing: "border-box" }}>
                                <option value="">Sin líder (asignar después)</option>
                                {projectHeads.map(ph => <option key={ph.id} value={ph.id}>{ph.username}</option>)}
                            </select>
                            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                                <button onClick={() => setShowCreateProject(false)} style={{ padding: "10px 20px", background: "#f3f4f6", border: "none", borderRadius: "8px", cursor: "pointer" }}>Cancelar</button>
                                <button onClick={handleCreateProject} disabled={!newProjectName} style={{ padding: "10px 20px", background: newProjectName ? "#0a6ed1" : "#d1d5db", color: "white", border: "none", borderRadius: "8px", cursor: newProjectName ? "pointer" : "not-allowed" }}>Crear</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Assign Project Leader Modal */}
                {showEditProject && (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                        <div style={{ background: "white", borderRadius: "12px", padding: "32px", width: "400px" }}>
                            <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px" }}>Asignar Líder</h3>
                            <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>Proyecto: <strong>{showEditProject.name}</strong></p>
                            <select value={editProjectLeader} onChange={e => setEditProjectLeader(e.target.value)}
                                style={{ width: "100%", padding: "12px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "20px", boxSizing: "border-box" }}>
                                <option value="">Seleccionar líder</option>
                                {projectHeads.map(ph => <option key={ph.id} value={ph.id}>{ph.username}</option>)}
                            </select>
                            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                                <button onClick={() => setShowEditProject(null)} style={{ padding: "10px 20px", background: "#f3f4f6", border: "none", borderRadius: "8px", cursor: "pointer" }}>Cancelar</button>
                                <button onClick={handleAssignProjectLeader} disabled={!editProjectLeader} style={{ padding: "10px 20px", background: editProjectLeader ? "#0a6ed1" : "#d1d5db", color: "white", border: "none", borderRadius: "8px", cursor: editProjectLeader ? "pointer" : "not-allowed" }}>Asignar</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ========== PROJECT_HEAD VIEW ==========
    if (user?.role === "project_head") {
        return (
            <div style={{ padding: "40px" }}>
                <div style={{ maxWidth: "900px", margin: "0 auto" }}>
                    <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px" }}>
                        {myProject ? myProject.name : "Mi Proyecto"}
                    </h1>
                    <p style={{ color: "#666", marginBottom: "24px" }}>Gestiona tu equipo y archivos del proyecto</p>

                    {message && <div style={{ padding: "12px", background: "#ecfdf5", border: "1px solid #10b981", borderRadius: "8px", marginBottom: "16px", color: "#065f46" }}>{message}<button onClick={() => setMessage("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer" }}>×</button></div>}

                    {!myProject ? (
                        <p style={{ color: "#999" }}>No tienes un proyecto asignado.</p>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                            {/* Members */}
                            <div style={{ background: "white", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                                    <h2 style={{ fontSize: "18px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}><UsersIcon /> Miembros</h2>
                                    <button onClick={() => setShowAddMember(true)} style={{ padding: "8px 12px", background: "#10b981", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}>
                                        <PlusIcon /> Añadir
                                    </button>
                                </div>
                                {(!myProject.members || myProject.members.length === 0) ? (
                                    <p style={{ color: "#999", fontSize: "14px" }}>No hay miembros en el proyecto.</p>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        {myProject.members.map(m => (
                                            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#f9fafb", borderRadius: "6px" }}>
                                                <span style={{ fontWeight: "500" }}>{m.user?.username}</span>
                                                <button onClick={() => handleRemoveMember(m.userId)} style={{ padding: "4px 8px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px" }}>Eliminar</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Recent Files */}
                            <div style={{ background: "white", borderRadius: "12px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                                <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}><FileIcon /> Últimos Archivos</h2>
                                {projectFiles.length === 0 ? (
                                    <p style={{ color: "#999", fontSize: "14px" }}>No hay archivos en el proyecto.</p>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        {projectFiles.map(f => (
                                            <div key={f.id} style={{ padding: "10px 12px", background: "#f9fafb", borderRadius: "6px" }}>
                                                <div style={{ fontWeight: "500", fontSize: "14px" }}>{f.filename}</div>
                                                <div style={{ fontSize: "12px", color: "#666" }}>{new Date(f.createdAt).toLocaleDateString()}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Add Member Modal */}
                {showAddMember && (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
                        <div style={{ background: "white", borderRadius: "12px", padding: "32px", width: "400px" }}>
                            <h3 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "20px" }}>Añadir Miembro</h3>
                            <input type="text" placeholder="Buscar usuario..." value={memberSearch} onChange={e => { setMemberSearch(e.target.value); searchUsers(e.target.value); }}
                                style={{ width: "100%", padding: "12px", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "12px", boxSizing: "border-box" }} />
                            <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                                {searchResults.map(u => (
                                    <button key={u.id} onClick={() => handleAddMember(u.id)}
                                        style={{ display: "block", width: "100%", padding: "12px", textAlign: "left", border: "none", background: "#f3f4f6", borderRadius: "8px", marginBottom: "8px", cursor: "pointer" }}>
                                        {u.username}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                                <button onClick={() => { setShowAddMember(false); setSearchResults([]); setMemberSearch(""); }} style={{ padding: "10px 20px", background: "#f3f4f6", border: "none", borderRadius: "8px", cursor: "pointer" }}>Cerrar</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ========== USER VIEW ==========
    return (
        <div style={{ padding: "40px" }}>
            <div style={{ maxWidth: "700px", margin: "0 auto" }}>
                <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px" }}>Mi Equipo</h1>
                <p style={{ color: "#666", marginBottom: "24px" }}>Tu proyecto y compañeros de equipo</p>

                {loading ? (
                    <p style={{ color: "#999" }}>Cargando...</p>
                ) : !myProject ? (
                    <div style={{ textAlign: "center", padding: "48px", background: "white", borderRadius: "12px" }}>
                        <p style={{ color: "#666" }}>Contacta con tu jefe de proyecto para ser añadido a un proyecto.</p>
                    </div>
                ) : (
                    <div style={{ display: "grid", gap: "24px" }}>
                        {/* Project Info */}
                        <div style={{ background: "linear-gradient(135deg, #0a6ed1 0%, #0052a3 100%)", borderRadius: "16px", padding: "24px", color: "white" }}>
                            <div style={{ fontSize: "14px", opacity: 0.9 }}>Mi Proyecto</div>
                            <div style={{ fontSize: "24px", fontWeight: "700", marginTop: "4px" }}>{myProject.name}</div>
                            <div style={{ fontSize: "14px", marginTop: "8px", opacity: 0.9 }}>
                                Líder: {myProject.leader?.username || "Sin asignar"} • Departamento: {myProject.department?.name || "-"}
                            </div>
                        </div>

                        {/* Two column layout */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                            {/* Team Members */}
                            <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                                <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                                    👥 Compañeros de Equipo
                                </h2>
                                {(!myProject.members || myProject.members.length === 0) ? (
                                    <p style={{ color: "#999", fontSize: "14px" }}>No hay otros miembros en el proyecto.</p>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        {myProject.members.map(m => (
                                            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", background: "#f9fafb", borderRadius: "8px" }}>
                                                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "600", color: "#4f46e5" }}>
                                                    {m.user?.username?.charAt(0).toUpperCase() || "?"}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: "500" }}>{m.user?.username}</div>
                                                    <div style={{ fontSize: "12px", color: "#666" }}>{m.user?.role || "Miembro"}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Shared Files */}
                            <div style={{ background: "white", borderRadius: "16px", padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                                <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                                    🔗 Últimos 5 compartidos
                                </h2>
                                {projectFiles.length === 0 ? (
                                    <p style={{ color: "#999", fontSize: "14px" }}>No hay documentos compartidos contigo.</p>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                        {projectFiles.map(f => (
                                            <div key={f.id} style={{ padding: "12px", background: "#f9fafb", borderRadius: "8px" }}>
                                                <div style={{ fontWeight: "500", fontSize: "14px" }}>{f.filename}</div>
                                                <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                                                    {f.owner?.username || "-"} • {new Date(f.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
