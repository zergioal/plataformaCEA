// cea-plataforma/web/src/pages/Login.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";
import logoCea from "../assets/logo-cea.png";

function toEmail(userOrEmail: string) {
  const u = userOrEmail.trim().toLowerCase();
  if (!u) return "";
  if (u.includes("@")) return u;
  return `${u}@cea.local`;
}

// Rate limiting local (respaldo)
const RATE_LIMIT_KEY = "login_rate_limit";
const MAX_LOCAL_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutos

function getRateLimitInfo(): { attempts: number; lockedUntil: number | null } {
  try {
    const data = sessionStorage.getItem(RATE_LIMIT_KEY);
    return data ? JSON.parse(data) : { attempts: 0, lockedUntil: null };
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

function setRateLimitInfo(attempts: number, lockedUntil: number | null) {
  sessionStorage.setItem(
    RATE_LIMIT_KEY,
    JSON.stringify({ attempts, lockedUntil }),
  );
}

function resetRateLimit() {
  sessionStorage.removeItem(RATE_LIMIT_KEY);
}

export default function Login() {
  const nav = useNavigate();
  const { loading, session } = useRole();

  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [localLockout, setLocalLockout] = useState<number | null>(() => {
    const info = getRateLimitInfo();
    return info.lockedUntil && info.lockedUntil > Date.now()
      ? info.lockedUntil
      : null;
  });
  const [remainingTime, setRemainingTime] = useState(0);
  const [inactiveAccount, setInactiveAccount] = useState(false);

  // Timer para countdown de bloqueo local
  useEffect(() => {
    if (!localLockout) return;

    const updateTimer = () => {
      const remaining = Math.max(0, localLockout - Date.now());
      setRemainingTime(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        setLocalLockout(null);
        resetRateLimit();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [localLockout]);

  useEffect(() => {
    if (!loading && session) nav("/app", { replace: true });
  }, [loading, session, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const email = toEmail(user);
    if (!email || !pass) {
      setMsg("Completa usuario/código y contraseña.");
      return;
    }

    // Verificar bloqueo local primero
    const rateLimitInfo = getRateLimitInfo();
    if (rateLimitInfo.lockedUntil && rateLimitInfo.lockedUntil > Date.now()) {
      setLocalLockout(rateLimitInfo.lockedUntil);
      setMsg("Demasiados intentos. Espera antes de intentar de nuevo.");
      return;
    }

    setSending(true);

    // Verificar si la cuenta está bloqueada en la BD
    try {
      const { data: lockCheck } = await supabase.rpc("check_account_locked", {
        p_email: email,
      });

      if (lockCheck?.locked) {
        setSending(false);
        setMsg(
          "Tu cuenta ha sido bloqueada por seguridad debido a múltiples intentos fallidos. Contacta al administrador para desbloquearla.",
        );
        return;
      }
    } catch {
      // Si falla la verificación, continuar con el login normal
    }

    // Intentar login
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });

    if (error) {
      // Registrar intento fallido en la BD
      try {
        const { data: attemptResult } = await supabase.rpc(
          "register_login_attempt",
          {
            p_email: email,
            p_success: false,
          },
        );

        if (attemptResult?.locked) {
          setSending(false);
          setMsg(
            "Tu cuenta ha sido bloqueada por seguridad debido a múltiples intentos fallidos. Contacta al administrador para desbloquearla.",
          );
          return;
        }

        // Mostrar intentos restantes
        if (
          attemptResult?.remaining !== undefined &&
          attemptResult.remaining > 0
        ) {
          setSending(false);
          setMsg(
            `Credenciales incorrectas. Te quedan ${attemptResult.remaining} intento(s) antes de que tu cuenta sea bloqueada.`,
          );

          // Actualizar rate limit local
          const newAttempts = rateLimitInfo.attempts + 1;
          if (newAttempts >= MAX_LOCAL_ATTEMPTS) {
            const lockUntil = Date.now() + LOCKOUT_DURATION;
            setRateLimitInfo(newAttempts, lockUntil);
            setLocalLockout(lockUntil);
          } else {
            setRateLimitInfo(newAttempts, null);
          }
          return;
        }
      } catch {
        // Si falla el registro, usar solo rate limit local
        const newAttempts = rateLimitInfo.attempts + 1;
        if (newAttempts >= MAX_LOCAL_ATTEMPTS) {
          const lockUntil = Date.now() + LOCKOUT_DURATION;
          setRateLimitInfo(newAttempts, lockUntil);
          setLocalLockout(lockUntil);
          setSending(false);
          setMsg("Demasiados intentos fallidos. Espera 5 minutos.");
          return;
        }
        setRateLimitInfo(newAttempts, null);
      }

      setSending(false);
      setMsg("Credenciales incorrectas. Verifica tu código y contraseña.");
      return;
    }

    // Login exitoso - resetear rate limit y registrar
    resetRateLimit();
    try {
      await supabase.rpc("register_login_attempt", {
        p_email: email,
        p_success: true,
      });
    } catch {
      // Ignorar errores al registrar login exitoso
    }

    // Verificar si el usuario está activo
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("is_active, role")
          .eq("id", sessionData.session.user.id)
          .single();

        // Solo verificar is_active para estudiantes
        if (profileData?.role === "student" && profileData?.is_active === false) {
          // Cerrar sesión inmediatamente
          await supabase.auth.signOut({ scope: "local" });
          setSending(false);
          setInactiveAccount(true);
          return;
        }
      }
    } catch {
      // Si falla la verificación, continuar con el login normal
    }

    setSending(false);
    nav("/app", { replace: true });
  }

  // Si la cuenta está inactiva, mostrar pantalla especial
  if (inactiveAccount) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md text-center">
          <div className="card p-8">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              Cuenta Inactiva
            </h2>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <p className="text-amber-800 font-medium">
                Tu cuenta de estudiante ha sido desactivada.
              </p>
              <p className="text-amber-700 text-sm mt-2">
                Esto puede deberse a que ya no formas parte de la institución o
                hay un problema con tu registro.
              </p>
            </div>
            <p className="text-gray-600 mb-6">
              Si crees que esto es un error, contacta con tu docente para que
              reactive tu cuenta.
            </p>
            <a
              href="https://wa.me/59170745899?text=Hola%2C%20mi%20cuenta%20de%20estudiante%20est%C3%A1%20inactiva.%20Mi%20c%C3%B3digo%20es%3A%20"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Contactar por WhatsApp
            </a>
            <button
              onClick={() => {
                setInactiveAccount(false);
                setUser("");
                setPass("");
              }}
              className="block w-full mt-4 text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Si hay bloqueo local activo, mostrar pantalla de espera
  if (localLockout && remainingTime > 0) {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md text-center">
          <div className="card p-8">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Demasiados intentos
            </h2>
            <p className="text-gray-600 mb-4">
              Por seguridad, debes esperar antes de intentar de nuevo.
            </p>
            <div className="text-3xl font-mono font-bold text-cea-primary">
              {minutes}:{seconds.toString().padStart(2, "0")}
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Si olvidaste tu contraseña, contacta al administrador.
            </p>
          </div>
        </div>
      </div>
    );
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
        {/* Botón volver al inicio */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-cea-primary transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Volver al inicio
          </Link>
        </div>

        {/* Logo y título */}
        <div className="text-center mb-8">
          <img
            src={logoCea}
            alt="Logo CEA"
            className="mx-auto mb-4 h-48 w-auto object-contain"
          />

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Plataforma CEA
          </h1>
          <p className="text-gray-500">
            Centro de Educación Alternativa "Madre María Oliva"
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
              placeholder="Ejm: SI0000"
              autoComplete="username"
              autoFocus
            />
            <p className="text-xs text-gray-500">
              Ingresa tu código de participante
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
              <a
                href="https://wa.me/59170745899?text=Hola%20soy%20...%20y%20olvid%C3%A9%20mi%20contrase%C3%B1a"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cea-primary font-medium hover:underline"
              >
                Contacta al administrador
              </a>
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-400">
            Desarrollado por: Ing. Sergio M. Alcocer Valenzuela - Cochabamba,
            Bolivia
          </p>
        </div>
      </div>
    </div>
  );
}
