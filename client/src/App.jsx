// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import FirstLoginChangePassword from "./components/RegistroInicial";
import Dashboard from "./components/Dashboard";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<FirstLoginChangePassword />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/file-crypto" element={<Dashboard />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
