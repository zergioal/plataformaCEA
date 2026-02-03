// supabase/functions/delete-user/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verificar autenticación
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Cliente con token del usuario
    const anonClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Verificar sesión
    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar que sea admin o teacher
    const { data: profile } = await anonClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const callerRole = profile?.role;
    if (!["admin", "teacher"].includes(callerRole)) {
      return new Response(
        JSON.stringify({ error: "Only admin or teacher can delete users" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Leer body
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No permitir auto-eliminación
    if (user_id === user.id) {
      return new Response(JSON.stringify({ error: "Cannot delete yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cliente admin
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verificar el rol del usuario a eliminar
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("role, code")
      .eq("id", user_id)
      .single();

    // No se puede eliminar admin
    if (targetProfile?.role === "admin") {
      return new Response(
        JSON.stringify({ error: "Cannot delete admin users" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Teachers solo pueden eliminar estudiantes
    if (callerRole === "teacher" && targetProfile?.role !== "student") {
      return new Response(
        JSON.stringify({ error: "Teachers can only delete students" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Eliminar en cascada usando service role
    // 1. Eliminar enrollments
    await adminClient.from("enrollments").delete().eq("student_id", user_id);

    // 2. Eliminar module_grades
    await adminClient.from("module_grades").delete().eq("student_id", user_id);

    // 3. Eliminar student_section_progress
    await adminClient
      .from("student_section_progress")
      .delete()
      .eq("student_id", user_id);

    // 4. Eliminar lesson_progress
    await adminClient
      .from("lesson_progress")
      .delete()
      .eq("student_id", user_id);

    // 5. Eliminar profile
    await adminClient.from("profiles").delete().eq("id", user_id);

    // 6. Eliminar de auth.users
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(
      user_id
    );
    if (deleteAuthError) {
      console.error("Error deleting auth user:", deleteAuthError);
      // No fallar si solo falla auth, ya eliminamos el profile
    }

    return new Response(
      JSON.stringify({
        ok: true,
        code: targetProfile?.code,
        message: "User deleted successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in delete-user:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
