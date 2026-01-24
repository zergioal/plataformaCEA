// cea-plataforma/web/src/pages/Login.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";

function toEmail(userOrEmail: string) {
  const u = userOrEmail.trim().toLowerCase();
  if (!u) return "";
  if (u.includes("@")) return u;
  return `${u}@cea.local`;
}

export default function Login() {
  const nav = useNavigate();
  const { loading, session } = useRole();

  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!loading && session) nav("/app", { replace: true });
  }, [loading, session, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSending(true);

    const email = toEmail(user);
    if (!email || !pass) {
      setSending(false);
      setMsg("Completa usuario/código y contraseña.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    setSending(false);

    if (error) {
      setMsg("Credenciales incorrectas. Verifica tu código y contraseña.");
      return;
    }

    nav("/app", { replace: true });
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="spinner w-8 h-8"></div>
      </div>
    );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <img
            src="src/assets/logo-cea.png"
            alt="Logo CEA"
            className="mx-auto mb-4 h-48 w-auto object-contain"
          />

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Plataforma CEA
          </h1>
          <p className="text-gray-500">
            Centro de Educación Alternativa Madre María Oliva
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={onSubmit} className="card p-6 space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Código de usuario
            </label>
            <input
              type="text"
              className="input"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="Ej: ADMIN, SI0001"
              autoComplete="username"
              autoFocus
            />
            <p className="text-xs text-gray-500">
              Ingresa solo tu código (sin @cea.local)
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              type="password"
              className="input"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {msg && (
            <div className="alert-error">
              <div className="flex items-start gap-2">
                <svg
                  className="w-5 h-5 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="text-sm">{msg}</div>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="btn-primary w-full"
          >
            {sending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner w-4 h-4"></span>
                Ingresando...
              </span>
            ) : (
              "Ingresar"
            )}
          </button>

          <div className="text-center pt-2">
            <p className="text-xs text-gray-500">
              ¿Olvidaste tu contraseña?{" "}
              <span className="text-cea-primary font-medium">
                Contacta al administrador
              </span>
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Desarrollado por: Sergio M. Alcocer Valenzuela - Cochabamba, Bolivia
          </p>
        </div>
      </div>
    </div>
  );
}
