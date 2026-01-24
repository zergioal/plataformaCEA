// supabase/functions/create-user/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CreateUserPayload = {
  role: "student" | "teacher";
  temp_password: string;
  first_names: string;
  last_name_pat?: string;
  last_name_mat?: string;
  phone: string;
  contact_email?: string;
  career_id: number;
  shift: "tarde" | "noche";
  level_id?: number; // solo para student
  likes?: string;
  avatar_key?: string;
  // Nuevos campos para estudiantes
  rudeal_number?: string;
  carnet_number?: string;
  gender?: "F" | "M";
  birth_date?: string;
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json(405, { error: "Use POST" });

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "No Authorization Bearer token" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validar caller con cliente anon
    const sb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData.user)
      return json(401, { error: "Token inválido" });

    const callerId = userData.user.id;

    const { data: callerProfile, error: profErr } = await sb
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .single();

    if (profErr)
      return json(403, { error: "No se pudo leer perfil del caller" });
    if (!["admin", "teacher"].includes(callerProfile?.role))
      return json(403, { error: "Solo admin o teacher pueden crear usuarios" });

    const payload = (await req.json()) as CreateUserPayload;

    // Validaciones
    if (!payload.role || !["student", "teacher"].includes(payload.role)) {
      return json(400, { error: "role debe ser student o teacher" });
    }

    if (!payload.first_names?.trim()) {
      return json(400, { error: "first_names es requerido" });
    }

    if (!payload.last_name_pat?.trim() && !payload.last_name_mat?.trim()) {
      return json(400, { error: "Al menos un apellido es requerido" });
    }

    if (!payload.phone?.trim()) {
      return json(400, { error: "phone es requerido" });
    }

    if (!payload.career_id) {
      return json(400, { error: "career_id es requerido" });
    }

    if (!payload.shift || !["tarde", "noche"].includes(payload.shift)) {
      return json(400, { error: "shift debe ser tarde o noche" });
    }

    if (payload.role === "student" && !payload.level_id) {
      return json(400, { error: "level_id es requerido para estudiantes" });
    }

    // Validar campos obligatorios para estudiantes
    if (payload.role === "student") {
      if (!payload.carnet_number?.trim()) {
        return json(400, { error: "carnet_number es requerido para estudiantes" });
      }
      if (!payload.gender || !["F", "M"].includes(payload.gender)) {
        return json(400, { error: "gender debe ser F o M para estudiantes" });
      }
      if (!payload.birth_date) {
        return json(400, { error: "birth_date es requerido para estudiantes" });
      }
    }

    // Obtener prefijo de carrera
    const { data: careerData, error: careerErr } = await sb
      .from("careers")
      .select("student_prefix")
      .eq("id", payload.career_id)
      .single();

    if (careerErr || !careerData)
      return json(400, { error: "career_id inválido" });

    const prefix = careerData.student_prefix;

    // Generar código único
    const { data: codeData, error: codeErr } = await sb.rpc("next_code", {
      p_prefix: prefix,
    });

    if (codeErr) return json(500, { error: "No se pudo generar código" });

    const code = codeData as string;
    const email = `${code.toLowerCase()}@cea.local`;

    // Crear full_name
    const parts = [
      payload.first_names?.trim(),
      payload.last_name_pat?.trim(),
      payload.last_name_mat?.trim(),
    ].filter(Boolean);
    const full_name = parts.join(" ");

    // Cliente admin para crear usuario
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: authData, error: authErr } =
      await admin.auth.admin.createUser({
        email,
        password: payload.temp_password,
        email_confirm: true,
        user_metadata: {
          full_name,
        },
      });

    if (authErr) return json(400, { error: authErr.message });
    if (!authData.user) return json(500, { error: "No se creó el usuario" });

    const userId = authData.user.id;

    // ✅ CRÍTICO: Actualizar profile con TODOS los campos
    const profileData: Record<string, unknown> = {
      role: payload.role,
      code,
      full_name,
      first_names: payload.first_names.trim(),
      last_name_pat: payload.last_name_pat?.trim() || null,
      last_name_mat: payload.last_name_mat?.trim() || null,
      phone: payload.phone.trim(),
      contact_email: payload.contact_email?.trim() || null,
      career_id: payload.career_id,
      shift: payload.shift,
      likes: payload.likes?.trim() || null,
      avatar_key: payload.avatar_key || "av1",
    };

    // Agregar campos adicionales para estudiantes
    if (payload.role === "student") {
      profileData.rudeal_number = payload.rudeal_number?.trim() || null;
      profileData.carnet_number = payload.carnet_number?.trim() || null;
      profileData.gender = payload.gender || null;
      profileData.birth_date = payload.birth_date || null;
    }

    const { error: updateErr } = await admin
      .from("profiles")
      .update(profileData)
      .eq("id", userId);

    if (updateErr) {
      // Rollback: eliminar usuario de auth
      await admin.auth.admin.deleteUser(userId);
      return json(500, { error: "No se pudo actualizar profile" });
    }

    // Si es estudiante, crear enrollment
    if (payload.role === "student" && payload.level_id) {
      const { error: enrollErr } = await admin.from("enrollments").insert({
        student_id: userId,
        level_id: payload.level_id,
      });

      if (enrollErr) {
        console.error("Error enrollment:", enrollErr);
        // No hacemos rollback total, solo advertimos
      }
    }

    return json(200, {
      ok: true,
      user_id: userId,
      email,
      code,
      temp_password: payload.temp_password,
    });
  } catch (e) {
    console.error("Error:", e);
    return json(500, { error: String(e) });
  }
});
