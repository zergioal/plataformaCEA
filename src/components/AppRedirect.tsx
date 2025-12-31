import { Navigate } from "react-router-dom";
import { useRole } from "../lib/useRole";

export default function AppRedirect() {
  const { loading, session, role } = useRole();

  if (loading) return <div className="p-6">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;

  const to =
    role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/student";
  return <Navigate to={to} replace />;
}
