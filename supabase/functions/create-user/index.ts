import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "student" | "teacher" | "admin";
type Shift = "tarde" | "noche";

type CreateUserBody = {
  // ahora code puede venir vacío si quieres autogeneración
  code?: string;

  role: Role;
  temp_password: string;

  first_names: string;
  last_name_pat?: string;
  last_name_mat?: string;

  phone: string;
  contact_email?: string;

  // obligatorio para student
  career_id?: number;
  shift: Shift;

  // solo si role=student
  level_id?: number;
};

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json(405, { error: "Use POST" });

    const body = (await req.json()) as Partial<CreateUserBody>;

    const role = body.role as Role;
    const temp_password = (body.temp_password ?? "").trim();

    const first_names = (body.first_names ?? "").trim();
    const last_name_pat = (body.last_name_pat ?? "").trim();
    const last_name_mat = (body.last_name_mat ?? "").trim();

    const phone = (body.phone ?? "").trim();
    const contact_email = (body.contact_email ?? "").trim();

    const shift = body.shift as Shift;

    if (!role || !temp_password || !first_names || !phone || !shift) {
      return json(400, {
        error:
          "Faltan campos obligatorios: role, temp_password, first_names, phone, shift",
      });
    }

    if (!["student", "teacher", "admin"].includes(role)) {
      return json(400, { error: "role inválido" });
    }

    if (!["tarde", "noche"].includes(shift)) {
      return json(400, { error: "shift inválido (tarde|noche)" });
    }

    // apellidos: al menos uno obligatorio
    if (!last_name_pat && !last_name_mat) {
      return json(400, {
        error: "Debes llenar al menos un apellido (paterno o materno)",
      });
    }

    // student: requiere career_id y level_id
    const career_id = body.career_id;
    if (role === "student") {
      if (!career_id)
        return json(400, { error: "Para student se requiere career_id" });
      if (!body.level_id)
        return json(400, { error: "Para student se requiere level_id" });
    }

    // Autorización: solo admin puede crear usuarios
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(401, { error: "No Authorization Bearer token" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Cliente normal para validar sesión + rol del caller
    const sb = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await sb.auth.getUser();
    if (userErr || !userData.user)
      return json(401, { error: "Token inválido" });

    const callerId = userData.user.id;

    const { data: callerProfile, error: callerProfErr } = await sb
      .from("profiles")
      .select("role")
      .eq("id", callerId)
      .single();

    if (callerProfErr)
      return json(403, { error: "No se pudo leer perfil del caller" });
    if (callerProfile?.role !== "admin")
      return json(403, { error: "Solo admin puede crear usuarios" });

    // Cliente admin
    const admin = createClient(supabaseUrl, serviceKey);

    // 1) Generar código si no viene
    let code = (body.code ?? "").trim();

    if (!code) {
      if (role === "teacher" || role === "admin") {
        code = await genCode(admin, "DO-");
      } else {
        // student => prefix desde careers.student_prefix
        const { data: car, error: carErr } = await admin
          .from("careers")
          .select("student_prefix")
          .eq("id", career_id!)
          .single();

        if (carErr || !car?.student_prefix)
          return json(400, { error: "career_id inválido" });

        code = await genCode(admin, `${car.student_prefix}-`);
      }
    }

    // Email interno (obligatorio en Supabase Auth)
    const email = `${code.toLowerCase()}@cea.local`;

    // 2) Crear auth user
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password: temp_password,
        email_confirm: true,
        user_metadata: { first_names, last_name_pat, last_name_mat },
      });

    if (createErr || !created.user) {
      return json(400, {
        error: createErr?.message ?? "No se pudo crear auth user",
      });
    }

    const newUserId = created.user.id;

    // 3) Actualizar profiles
    const profileUpdate = {
      role,
      code,
      first_names,
      last_name_pat: last_name_pat || null,
      last_name_mat: last_name_mat || null,
      phone,
      contact_email: contact_email || null,
      career_id: role === "student" ? career_id! : null,
      shift,
      full_name: `${first_names} ${last_name_pat || ""} ${
        last_name_mat || ""
      }`.trim(),
    };

    const { error: profUpErr } = await admin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", newUserId);

    if (profUpErr) {
      return json(500, {
        error: "No se pudo actualizar profile: " + profUpErr.message,
      });
    }

    // 4) Student: enrollments + module_grades
    if (role === "student") {
      const level_id = body.level_id!;

      const { error: enrErr } = await admin
        .from("enrollments")
        .insert({ student_id: newUserId, level_id });

      if (enrErr)
        return json(500, {
          error: "No se pudo crear enrollment: " + enrErr.message,
        });

      const { data: mods, error: modsErr } = await admin
        .from("modules")
        .select("id")
        .eq("level_id", level_id)
        .order("sort_order");

      if (modsErr)
        return json(500, {
          error: "No se pudo leer módulos: " + modsErr.message,
        });

      if (mods && mods.length > 0) {
        const rows = mods.map((m) => ({
          student_id: newUserId,
          module_id: m.id,
        }));
        const { error: gErr } = await admin.from("module_grades").insert(rows);
        if (gErr)
          return json(500, {
            error: "No se pudo crear module_grades: " + gErr.message,
          });
      }
    }

    return json(200, { ok: true, user_id: newUserId, email, temp_password });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});

async function genCode(admin: ReturnType<typeof createClient>, prefix: string) {
  // usa función next_code(prefix)
  const { data, error } = await admin.rpc("next_code", { p_prefix: prefix });
  if (error || !data)
    throw new Error("No se pudo generar código: " + (error?.message ?? ""));
  return String(data);
}
