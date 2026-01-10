import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AdminPanel from "./AdminPanel";
import DeptHeadPanel from "./DeptHeadPanel";
import ProjectHeadPanel from "./ProjectHeadPanel";
import UserPanel from "./UserPanel";

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

  if (user.role === "dept_head") {
    return <DeptHeadPanel />;
  }

  if (user.role === "project_head") {
    return <ProjectHeadPanel />;
  }

  return <UserPanel />;
}
