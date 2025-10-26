import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FileEncryptorDemo from "./FileEncryptorDemo";
import AdminPanel from "./AdminPanel";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  if (user.role === "admin") {
    return <AdminPanel />;
  }

  return <FileEncryptorDemo />;
}

