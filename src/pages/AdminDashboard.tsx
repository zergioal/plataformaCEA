import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

type Shift = "tarde" | "noche";
type CreateRole = "student" | "teacher";

type Level = { id: number; name: string; sort_order: number };
type Career = { id: number; name: string; student_prefix: string };

type ProfileRow = {
  id: string;
  code: string | null;
  full_name: string | null;
  role: "student" | "teacher" | "admin" | null;
  created_at?: string | null;
  phone?: string | null;
  shift?: string | null;
};

type CreateUserPayload = {
  role: CreateRole;
  temp_password: string;

  first_names: string;
  last_name_pat?: string;
  last_name_mat?: string;

  phone: string;
  contact_email?: string;

  career_id: number;
  shift: Shift;

  level_id?: number; // solo student
};

type CreateUserSuccess = {
  ok: true;
  user_id: string;
  email: string;
  temp_password: string;
  code?: string; // si tu function lo devuelve
};

type CreateUserFail = { error: string };

function randomPass(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function asText(x: unknown) {
  if (typeof x === "string") return x;
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

function isFail(x: unknown): x is CreateUserFail {
  return (
    typeof x === "object" &&
    x !== null &&
    "error" in x &&
    typeof (x as CreateUserFail).error === "string"
  );
}

export default function AdminDashboard() {
  const nav = useNavigate();
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "");
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "");

  // catálogos
  const [levels, setLevels] = useState<Level[]>([]);
  const [careers, setCareers] = useState<Career[]>([]);

  // crear usuario
  const [role, setRole] = useState<CreateRole>("student");
  const [careerId, setCareerId] = useState<number | "">("");
  const [shift, setShift] = useState<Shift>("tarde");

  const [firstNames, setFirstNames] = useState("");
  const [lastPat, setLastPat] = useState("");
  const [lastMat, setLastMat] = useState("");

  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [levelId, setLevelId] = useState<number | "">("");
  const [tempPassword, setTempPassword] = useState(randomPass());

  const [msg, setMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // lista usuarios
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [q, setQ] = useState("");

  async function loadCatalogs() {
    // careers
    const c = await supabase
      .from("careers")
      .select("id,name,student_prefix")
      .order("name");
    if (c.error) setMsg("Error cargando carreras: " + c.error.message);
    else setCareers((c.data as Career[]) ?? []);

    // levels
    const l = await supabase
      .from("levels")
      .select("id,name,sort_order")
      .order("sort_order");
    if (l.error) setMsg("Error cargando niveles: " + l.error.message);
    else setLevels((l.data as Level[]) ?? []);
  }

  async function loadUsers() {
    setUsersLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,code,full_name,role,created_at,phone,shift")
      .order("created_at", { ascending: false });

    setUsersLoading(false);

    if (error) {
      setMsg("Error cargando usuarios: " + error.message);
      return;
    }

    setUsers((data as ProfileRow[]) ?? []);
  }

  useEffect(() => {
    loadCatalogs();
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => {
      const a = (u.code ?? "").toLowerCase();
      const b = (u.full_name ?? "").toLowerCase();
      const c = (u.role ?? "").toLowerCase();
      const d = (u.phone ?? "").toLowerCase();
      return a.includes(s) || b.includes(s) || c.includes(s) || d.includes(s);
    });
  }, [users, q]);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCreating(true);

    if (!supabaseUrl || !anonKey) {
      setCreating(false);
      setMsg(
        "Faltan variables .env: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY"
      );
      return;
    }

    // sesión
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      setCreating(false);
      setMsg("No hay sesión activa. Vuelve a iniciar sesión.");
      return;
    }

    // validaciones
    const fn = firstNames.trim();
    const lp = lastPat.trim();
    const lm = lastMat.trim();
    const ph = phone.trim();
    const em = contactEmail.trim();

    if (!fn) {
      setCreating(false);
      setMsg("Nombres es obligatorio.");
      return;
    }
    if (!lp && !lm) {
      setCreating(false);
      setMsg("Debes llenar al menos un apellido (paterno o materno).");
      return;
    }
    if (!ph) {
      setCreating(false);
      setMsg("Celular es obligatorio.");
      return;
    }
    if (!careerId) {
      setCreating(false);
      setMsg("Carrera es obligatoria.");
      return;
    }

    if (role === "student" && !levelId) {
      setCreating(false);
      setMsg("Para estudiante debes seleccionar un nivel.");
      return;
    }

    const payload: CreateUserPayload = {
      role,
      temp_password: tempPassword,
      first_names: fn,
      last_name_pat: lp || undefined,
      last_name_mat: lm || undefined,
      phone: ph,
      contact_email: em || undefined,
      career_id: Number(careerId),
      shift,
      ...(role === "student" ? { level_id: Number(levelId) } : {}),
    };

    // llamada function
    const url = `${supabaseUrl}/functions/v1/create-user`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    setCreating(false);

    let out: unknown = { raw };
    try {
      out = raw
        ? (JSON.parse(raw) as unknown)
        : ({ error: "Respuesta vacía" } as CreateUserFail);
    } catch {
      // queda raw
    }

    if (!res.ok) {
      const errMsg = isFail(out) ? out.error : asText(out);
      setMsg(`Error ${res.status}:\n${errMsg}\n\nRAW:\n${raw || "(vacío)"}`);
      return;
    }

    const ok = out as CreateUserSuccess;

    // si tu edge function NO devuelve "code", lo sacamos del email:
    const codeFromEmail = ok.email?.split("@")[0]?.toUpperCase();

    setMsg(
      `✅ Usuario creado\n` +
        `Código: ${ok.code ?? codeFromEmail ?? "(no disponible)"}\n` +
        `Email interno: ${ok.email}\n` +
        `Pass temporal: ${ok.temp_password}`
    );

    // limpiar
    setFirstNames("");
    setLastPat("");
    setLastMat("");
    setPhone("");
    setContactEmail("");
    setCareerId("");
    setShift("tarde");
    setLevelId("");
    setTempPassword(randomPass());

    await loadUsers();
  }

  async function resetPassword(userId: string) {
    setMsg(null);
    setUsersLoading(true);

    if (!supabaseUrl || !anonKey) {
      setUsersLoading(false);
      setMsg(
        "Faltan variables .env: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY"
      );
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;

    if (!session) {
      setUsersLoading(false);
      setMsg("No hay sesión activa.");
      return;
    }

    const url = `${supabaseUrl}/functions/v1/reset-password`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ user_id: userId }),
    });

    const raw = await res.text();
    setUsersLoading(false);

    if (!res.ok) {
      setMsg(`Reset error (${res.status}):\n${raw}`);
      return;
    }

    try {
      const out = JSON.parse(raw) as { ok: true; new_password: string };
      setMsg(`✅ Password reseteada:\nNueva pass: ${out.new_password}`);
    } catch {
      setMsg("✅ Reseteado, pero respuesta no JSON:\n" + raw);
    }
  }

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>

        <button
          className="rounded-xl px-3 py-2 bg-black text-white"
          onClick={async () => {
            await supabase.auth.signOut();
            nav("/login", { replace: true });
          }}
        >
          Cerrar sesión
        </button>
      </div>

      {/* Crear usuario */}
      <form
        onSubmit={createUser}
        className="bg-white rounded-2xl shadow p-5 space-y-4"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold">Crear usuario</h2>
          <div className="text-xs text-gray-500">
            Código: <span className="font-medium">autogenerado</span> (readonly)
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Rol</label>
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={role}
              onChange={(e) => setRole(e.target.value as CreateRole)}
            >
              <option value="student">Estudiante</option>
              <option value="teacher">Docente</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Carrera</label>
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={careerId}
              onChange={(e) =>
                setCareerId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">Selecciona...</option>
              {careers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Turno</label>
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={shift}
              onChange={(e) => setShift(e.target.value as Shift)}
            >
              <option value="tarde">Tarde</option>
              <option value="noche">Noche</option>
            </select>
          </div>
        </div>

        {role === "student" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1 md:col-span-1">
              <label className="text-sm font-medium">Nivel</label>
              <select
                className="w-full border rounded-xl px-3 py-2"
                value={levelId}
                onChange={(e) =>
                  setLevelId(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">Selecciona...</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1 md:col-span-1">
            <label className="text-sm font-medium">Nombres</label>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={firstNames}
              onChange={(e) => setFirstNames(e.target.value)}
              placeholder="Juan Carlos"
            />
          </div>

          <div className="space-y-1 md:col-span-1">
            <label className="text-sm font-medium">Apellido paterno</label>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={lastPat}
              onChange={(e) => setLastPat(e.target.value)}
              placeholder="Pérez"
            />
          </div>

          <div className="space-y-1 md:col-span-1">
            <label className="text-sm font-medium">Apellido materno</label>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={lastMat}
              onChange={(e) => setLastMat(e.target.value)}
              placeholder="Gómez"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1 md:col-span-1">
            <label className="text-sm font-medium">Celular</label>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="70707070"
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium">Correo (opcional)</label>
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="correo@gmail.com"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Contraseña temporal</label>
          <div className="flex gap-2">
            <input
              className="w-full border rounded-xl px-3 py-2"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
            />
            <button
              type="button"
              className="rounded-xl px-3 py-2 border"
              onClick={() => setTempPassword(randomPass())}
            >
              Generar
            </button>
          </div>
        </div>

        {msg && (
          <pre className="text-sm bg-gray-50 border rounded-xl p-3 whitespace-pre-wrap">
            {msg}
          </pre>
        )}

        <button
          disabled={creating}
          className="w-full rounded-xl px-3 py-2 font-semibold bg-black text-white disabled:opacity-60"
        >
          {creating ? "Creando..." : "Crear"}
        </button>
      </form>

      {/* Lista usuarios */}
      <section className="bg-white rounded-2xl shadow p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Usuarios</h2>

          <div className="flex gap-2">
            <input
              className="border rounded-xl px-3 py-2"
              placeholder="Buscar: código, nombre, rol, celular..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              className="rounded-xl px-3 py-2 border"
              onClick={loadUsers}
              type="button"
            >
              {usersLoading ? "Cargando..." : "Refrescar"}
            </button>
          </div>
        </div>

        <div className="overflow-auto border rounded-2xl">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Código</th>
                <th className="text-left p-3">Nombre</th>
                <th className="text-left p-3">Rol</th>
                <th className="text-left p-3">Celular</th>
                <th className="text-left p-3">UID</th>
                <th className="text-left p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="p-3 font-medium">{u.code ?? "-"}</td>
                  <td className="p-3">{u.full_name ?? "-"}</td>
                  <td className="p-3">{u.role ?? "-"}</td>
                  <td className="p-3">{u.phone ?? "-"}</td>
                  <td className="p-3 text-xs text-gray-500">{u.id}</td>
                  <td className="p-3">
                    <button
                      className="rounded-xl px-3 py-2 border"
                      type="button"
                      onClick={() => resetPassword(u.id)}
                    >
                      Reset Pass
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={6}>
                    {usersLoading ? "Cargando..." : "Sin resultados"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
