// supabase/functions/update-user/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UpdateUserPayload = {
  user_id: string;
  first_names?: string;
  last_name_pat?: string;
  last_name_mat?: string;
  phone?: string;
  contact_email?: string;
  career_id?: number;
  shift?: "tarde" | "noche";
  level_id?: number;
  likes?: string;
  avatar_key?: string;
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
    console.log("Auth Header received:", authHeader ? "Present" : "Missing");

    if (!authHeader.startsWith("Bearer ")) {
      console.log("Auth header invalid format");
      return json(401, { error: "No Authorization Bearer token" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log("Creating client with auth header");

    // Validar caller con cliente anon
    const sb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    console.log("Getting user from token");
    const { data: userData, error: userErr } = await sb.auth.getUser();

    if (userErr) {
      console.log("User error:", userErr);
      return json(401, { error: "Token inválido: " + userErr.message });
    }

    if (!userData.user) {
      console.log("No user data");
      return json(401, { error: "Token inválido: no user data" });
    }

    console.log("User authenticated:", userData.user.id);

    const callerId = userData.user.id;

    const { data: callerProfile, error: profErr } = await sb
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .single();

    if (profErr)
      return json(403, { error: "No se pudo leer perfil del caller" });
    if (!["admin", "teacher"].includes(callerProfile?.role))
      return json(403, { error: "Solo admin o teacher pueden actualizar usuarios" });

    const payload = (await req.json()) as UpdateUserPayload;

    if (!payload.user_id) {
      return json(400, { error: "user_id es requerido" });
    }

    // Cliente admin para actualizar
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Obtener perfil actual
    const { data: currentProfile } = await admin
      .from("profiles")
      .select("role, first_names, last_name_pat, last_name_mat")
      .eq("id", payload.user_id)
      .single();

    if (!currentProfile) {
      return json(404, { error: "Usuario no encontrado" });
    }

    // Construir objeto de actualización
    const updateData: Record<string, unknown> = {};

    if (payload.first_names !== undefined) {
      updateData.first_names = payload.first_names.trim();
    }
    if (payload.last_name_pat !== undefined) {
      updateData.last_name_pat = payload.last_name_pat?.trim() || null;
    }
    if (payload.last_name_mat !== undefined) {
      updateData.last_name_mat = payload.last_name_mat?.trim() || null;
    }
    if (payload.phone !== undefined) {
      updateData.phone = payload.phone.trim();
    }
    if (payload.contact_email !== undefined) {
      updateData.contact_email = payload.contact_email?.trim() || null;
    }
    if (payload.career_id !== undefined) {
      updateData.career_id = payload.career_id;
    }
    if (payload.shift !== undefined) {
      updateData.shift = payload.shift;
    }
    if (payload.likes !== undefined) {
      updateData.likes = payload.likes?.trim() || null;
    }
    if (payload.avatar_key !== undefined) {
      updateData.avatar_key = payload.avatar_key;
    }

    // Campos adicionales para estudiantes
    if (currentProfile.role === "student") {
      if (payload.rudeal_number !== undefined) {
        updateData.rudeal_number = payload.rudeal_number?.trim() || null;
      }
      if (payload.carnet_number !== undefined) {
        updateData.carnet_number = payload.carnet_number?.trim() || null;
      }
      if (payload.gender !== undefined) {
        updateData.gender = payload.gender || null;
      }
      if (payload.birth_date !== undefined) {
        updateData.birth_date = payload.birth_date || null;
      }
    }

    // Actualizar full_name si se modificaron nombres o apellidos
    if (
      payload.first_names !== undefined ||
      payload.last_name_pat !== undefined ||
      payload.last_name_mat !== undefined
    ) {
      const firstName = payload.first_names?.trim() || currentProfile.first_names || "";
      const lastPat = payload.last_name_pat !== undefined
        ? payload.last_name_pat?.trim()
        : currentProfile.last_name_pat;
      const lastMat = payload.last_name_mat !== undefined
        ? payload.last_name_mat?.trim()
        : currentProfile.last_name_mat;

      const parts = [firstName, lastPat, lastMat].filter(Boolean);
      updateData.full_name = parts.join(" ");
    }

    // Actualizar profile
    const { error: updateErr } = await admin
      .from("profiles")
      .update(updateData)
      .eq("id", payload.user_id);

    if (updateErr) {
      return json(500, { error: "Error al actualizar: " + updateErr.message });
    }

    return json(200, {
      ok: true,
      message: "Usuario actualizado correctamente",
    });
  } catch (e) {
    console.error("Error:", e);
    return json(500, { error: String(e) });
  }
});
