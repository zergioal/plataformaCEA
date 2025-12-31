// supabase/functions/reset-password/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Body = { user_id: string; new_password?: string };

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function randomPass(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") return json(405, { error: "Use POST" });

    const body = (await req.json()) as Partial<Body>;
    const user_id = (body.user_id ?? "").trim();

    if (!user_id) return json(400, { error: "Falta user_id" });

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "No Authorization Bearer token" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validar al caller + su rol con cliente anon (JWT del usuario)
    const sb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData.user)
      return json(401, { error: "Token inválido" });

    const callerId = userData.user.id;

    // Leer rol del caller (ojo: RLS permite leer su propio perfil)
    const { data: callerProfile, error: profErr } = await sb
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .single();

    if (profErr)
      return json(403, { error: "No se pudo leer perfil del caller" });
    if (callerProfile?.role !== "admin")
      return json(403, { error: "Solo admin" });

    // Generar password (o usar la que te manden)
    const newPassword = (body.new_password ?? "").trim() || randomPass();

    // Cliente admin
    const admin = createClient(supabaseUrl, serviceKey);

    const { data, error } = await admin.auth.admin.updateUserById(user_id, {
      password: newPassword,
    });

    if (error) return json(400, { error: error.message });
    if (!data.user)
      return json(500, { error: "No se pudo actualizar usuario" });

    return json(200, { ok: true, user_id, new_password: newPassword });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
