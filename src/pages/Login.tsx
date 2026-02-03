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

    setSending(false);
    nav("/app", { replace: true });
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
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
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
              placeholder="Ejm: SI-0000"
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
