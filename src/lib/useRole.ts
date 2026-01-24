// cea-plataforma/web/src/lib/useRole.ts
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export type Role = "student" | "teacher" | "admin";

type ProfileRow = {
  id: string;
  role: Role;
  code: string | null;
  full_name: string | null;
  first_names: string | null;
  last_name_pat: string | null;
  last_name_mat: string | null;
  phone: string | null;
  contact_email: string | null;
  likes: string | null;
  avatar_key: string | null;
  shift: string | null;
  career_id: number | null;
  rudeal_number: string | null;
  carnet_number: string | null;
  gender: "F" | "M" | null;
  birth_date: string | null;
};

// Cache key
const SESSION_CACHE_KEY = "user_session_cache";

// Helper para cargar desde cache
const loadFromCache = () => {
  try {
    const cached = sessionStorage.getItem(SESSION_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

// Helper para guardar en cache
const saveToCache = (data: { session: unknown; role: Role | null; profile: ProfileRow | null }) => {
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignorar errores de storage
  }
};

export function useRole() {
  // Intentar cargar desde cache primero
  const cachedData = loadFromCache();

  const [loading, setLoading] = useState(!cachedData);
  const [session, setSession] = useState<
    | Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]
    | null
  >(cachedData?.session || null);
  const [role, setRole] = useState<Role | null>(cachedData?.role || null);
  const [profile, setProfile] = useState<ProfileRow | null>(cachedData?.profile || null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      // Si ya tenemos datos en cache, no mostrar loading
      const hasCache = loadFromCache();
      if (!hasCache) {
        setLoading(true);
      }

      const { data } = await supabase.auth.getSession();
      const s = data.session;

      if (!mounted) return;

      setSession(s);

      if (!s) {
        setRole(null);
        setProfile(null);
        setLoading(false);
        // Limpiar cache si no hay sesión
        sessionStorage.removeItem(SESSION_CACHE_KEY);
        return;
      }

      // ✅ Cargar perfil completo
      const { data: p, error } = await supabase
        .from("profiles")
        .select(
          "id,role,code,full_name,first_names,last_name_pat,last_name_mat,phone,contact_email,likes,avatar_key,shift,career_id,rudeal_number,carnet_number,gender,birth_date"
        )
        .eq("id", s.user.id)
        .single();

      if (!mounted) return;

      if (error) {
        console.error("Error cargando perfil:", error);
        setRole(null);
        setProfile(null);
      } else {
        const newRole = (p?.role ?? null) as Role | null;
        const newProfile = p as ProfileRow;

        setRole(newRole);
        setProfile(newProfile);

        // Guardar en cache
        saveToCache({
          session: s,
          role: newRole,
          profile: newProfile,
        });
      }

      setLoading(false);
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Solo recargar en eventos importantes, no en cada cambio
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
        load();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { loading, session, role, profile };
}
