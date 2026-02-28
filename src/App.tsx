// cea-plataforma/web/src/App.tsx
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppRedirect from "./components/AppRedirect";
import ProtectedRoute from "./components/ProtectedRoute";
import RequireRole from "./components/RequireRole";

// Páginas protegidas
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import AdminContentManager from "./pages/AdminContentManager";
import TeacherDashboard from "./pages/TeacherDashboard";
import TeacherModuleGrades from "./pages/TeacherModuleGrades";
import TeacherModules from "./pages/TeacherModules";
import TeacherStudentGrades from "./pages/TeacherStudentGrades";
import StudentDashboard from "./pages/StudentDashboard";
import StudentModule from "./pages/StudentModule";
import TeacherContentManager from "./pages/TeacherContentManager";
import TeacherAttendancePage from "./pages/TeacherAttendancePage";

// Páginas públicas
import { PublicLayout } from "./components/public";
import {
  HomePage,
  SistemasPage,
  GastronomiaPage,
  ContaduriaPage,
  TextilPage,
} from "./pages/public";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ===== RUTAS PÚBLICAS ===== */}
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="carreras/sistemas" element={<SistemasPage />} />
          <Route path="carreras/gastronomia" element={<GastronomiaPage />} />
          <Route path="carreras/contaduria" element={<ContaduriaPage />} />
          <Route path="carreras/textil" element={<TextilPage />} />
        </Route>

        {/* ===== AUTENTICACIÓN ===== */}
        <Route path="/login" element={<Login />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppRedirect />
            </ProtectedRoute>
          }
        />

        {/* ADMIN */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <RequireRole allow={["admin", "administrativo"]}>
                <AdminDashboard />
              </RequireRole>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/content"
          element={
            <ProtectedRoute>
              <RequireRole allow={["admin"]}>
                <AdminContentManager />
              </RequireRole>
            </ProtectedRoute>
          }
        />

        {/* TEACHER */}
        <Route
          path="/teacher/content"
          element={
            <ProtectedRoute>
              <RequireRole allow={["teacher", "admin"]}>
                <TeacherContentManager />
              </RequireRole>
            </ProtectedRoute>
          }
        />

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

        <Route
          path="/teacher/modules"
          element={
            <ProtectedRoute>
              <RequireRole allow={["teacher", "admin"]}>
                <TeacherModules />
              </RequireRole>
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher/attendance"
          element={
            <ProtectedRoute>
              <RequireRole allow={["teacher", "admin"]}>
                <TeacherAttendancePage />
              </RequireRole>
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher/student/:studentId/grades"
          element={
            <ProtectedRoute>
              <RequireRole allow={["teacher", "admin"]}>
                <TeacherStudentGrades />
              </RequireRole>
            </ProtectedRoute>
          }
        />

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

        {/* STUDENT */}
        <Route
          path="/student"
          element={
            <ProtectedRoute>
              <RequireRole allow={["student"]}>
                <StudentDashboard />
              </RequireRole>
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/module/:moduleId"
          element={
            <ProtectedRoute>
              <RequireRole allow={["student"]}>
                <StudentModule />
              </RequireRole>
            </ProtectedRoute>
          }
        />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
