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

  // ✅ Si ya hay sesión, no te deja quedarte en /login
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
      setMsg("Login error: " + error.message);
      return;
    }

    nav("/app", { replace: true });
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="text-sm text-gray-600">Cargando...</div>
      </div>
    );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-gray-50 to-white">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-white/90 backdrop-blur rounded-2xl shadow-lg ring-1 ring-black/5 p-6 space-y-4"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Ingresar</h1>
          <p className="text-sm text-gray-600">
            Usa tu <span className="font-medium">código</span> (ej:{" "}
            <span className="font-mono">admin</span>) o tu correo.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Código o email
          </label>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-300"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="admin"
            autoComplete="username"
          />
          <p className="text-xs text-gray-500">
            Si pones solo el código, se convierte a{" "}
            <span className="font-mono">codigo@cea.local</span>
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">
            Contraseña
          </label>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-300"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        {msg && (
          <div className="text-sm bg-amber-50 border border-amber-200 rounded-xl p-3 whitespace-pre-wrap text-amber-900">
            {msg}
          </div>
        )}

        <button
          disabled={sending}
          className="w-full rounded-xl px-3 py-2 font-semibold bg-black text-white hover:bg-black/90 active:scale-[0.99] transition disabled:opacity-60"
        >
          {sending ? "Ingresando..." : "Ingresar"}
        </button>

        <div className="text-xs text-gray-400 text-center">
          Plataforma CEA • Sistemas Informáticos
        </div>
      </form>
    </div>
  );
}
