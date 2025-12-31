import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./index.css";

import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import StudentModule from "./pages/StudentModule";

import AppRedirect from "./components/AppRedirect";
import ProtectedRoute from "./components/ProtectedRoute";
import RequireRole from "./components/RequireRole";

// ✅ NUEVO: página de calificaciones del docente
import TeacherModuleGrades from "./pages/TeacherModuleGrades";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Root: manda a /app (decide por rol si hay sesión) */}
        <Route path="/" element={<Navigate to="/app" replace />} />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<AppRedirect />} />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <RequireRole allow={["admin"]}>
                <AdminDashboard />
              </RequireRole>
            </ProtectedRoute>
          }
        />

        {/* Teacher */}
        <Route
          path="/teacher"
          element={
            <ProtectedRoute>
              <RequireRole allow={["teacher", "admin"]}>
                <TeacherDashboard />
              </RequireRole>
            </ProtectedRoute>
          }
        />

        {/* ✅ NUEVO: Teacher grades por módulo */}
        <Route
          path="/teacher/module/:moduleId/grades"
          element={
            <ProtectedRoute>
              <RequireRole allow={["teacher", "admin"]}>
                <TeacherModuleGrades />
              </RequireRole>
            </ProtectedRoute>
          }
        />

        {/* Student */}
        <Route
          path="/student"
          element={
            <ProtectedRoute>
              <RequireRole allow={["student", "teacher", "admin"]}>
                <StudentDashboard />
              </RequireRole>
            </ProtectedRoute>
          }
        />

        {/* Student Module Player */}
        <Route
          path="/student/module/:moduleId"
          element={
            <ProtectedRoute>
              <RequireRole allow={["student", "teacher", "admin"]}>
                <StudentModule />
              </RequireRole>
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
