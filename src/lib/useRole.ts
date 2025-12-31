import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

export type Role = "admin" | "student" | "teacher";

export function useRole() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    let active = true;
    let roleReqId = 0;

    async function loadRoleForSession(s: Session | null) {
      if (!active) return;

      setSession(s);

      if (!s) {
        setRole(null);
        return;
      }

      const myReq = ++roleReqId;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", s.user.id)
          .maybeSingle();

        if (!active || myReq !== roleReqId) return;

        if (error) {
          console.error("role read error:", error);
          setRole(null);
        } else {
          setRole((data?.role ?? null) as Role | null);
        }
      } catch (e) {
        if (!active || myReq !== roleReqId) return;
        console.error("role read throw:", e);
        setRole(null);
      }
    }

    // 1) Inicial: getSession (con finally SI O SI)
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        await loadRoleForSession(data.session);
      } catch (e) {
        if (!active) return;
        console.error("getSession throw:", e);
        setSession(null);
        setRole(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    // 2) Listener: usa la session que entrega Supabase (no vuelvas a getSession)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      setLoading(false); // ya no volvemos a "true" para evitar “Cargando…” pegado
      void loadRoleForSession(s);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { loading, session, role };
}
