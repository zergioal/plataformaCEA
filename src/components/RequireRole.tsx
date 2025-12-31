// RequireRole.tsx
import { Navigate, useLocation } from "react-router-dom";
import { useRole } from "../lib/useRole";
import type { Role } from "../lib/useRole";

export default function RequireRole({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const { loading, session, role } = useRole();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Cargando...
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // 🔥 CLAVE: mientras no tengas role, NO redirijas
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Cargando rol...
      </div>
    );
  }

  if (!allow.includes(role)) {
    const fallback =
      role === "student" ? "/student" : role === "admin" ? "/admin" : "/app";

    // evita redirección repetida al mismo lugar
    if (location.pathname === fallback) return null;

    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
