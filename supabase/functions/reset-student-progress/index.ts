// supabase/functions/reset-student-progress/index.ts
// Borra student_section_progress, lesson_progress y eval_quiz_attempts
// para una lista de estudiantes. Requiere rol admin o teacher.
// Usa SERVICE_ROLE_KEY para saltarse RLS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar sesión del solicitante
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Solo admin y teacher pueden ejecutar esto
    const { data: profile } = await anonClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!["admin", "teacher", "administrativo"].includes(profile?.role)) {
      return new Response(JSON.stringify({ error: "Permiso denegado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { student_ids } = await req.json() as { student_ids: string[] };
    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return new Response(JSON.stringify({ error: "student_ids requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await adminClient.from("student_section_progress").delete().in("student_id", student_ids);
    await adminClient.from("lesson_progress").delete().in("student_id", student_ids);
    await adminClient.from("eval_quiz_attempts").delete().in("student_id", student_ids);

    return new Response(
      JSON.stringify({ ok: true, count: student_ids.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in reset-student-progress:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
