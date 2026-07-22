const PASSWORD_MIN_LENGTH = 8;

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Origin": "*"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const url = new URL(request.url);
    const route = getFunctionRoute(url.pathname);

    if (request.method === "GET" && route.length === 0) {
      return jsonResponse({ service: "auth", success: true }, 200);
    }

    if (request.method !== "POST") {
      return jsonResponse({ success: false, error: "Method not allowed." }, 405);
    }

    const payload = await readJsonBody(request);

    if (route[0] === "signin") {
      return jsonResponse(await signInAuthUser(payload), 200);
    }

    if (route[0] === "signup") {
      return jsonResponse(await registerAuthUser(payload), 200);
    }

    return jsonResponse({ success: false, error: "Not found." }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auth request failed.";
    const status = typeof (error as any)?.statusCode === "number" ? (error as any).statusCode : 500;
    console.error("[auth]", error);
    return jsonResponse({ success: false, error: message }, status);
  }
});

async function signInAuthUser({ otp = "", password, username }: any) {
  const identifier = normalizeIdentifier(username);
  const normalizedPassword = String(password || "");

  if (!identifier || !normalizedPassword) {
    throw statusError("Username and password are required.", 400);
  }

  const storedUser = await loadUserByIdentifier(identifier);
  if (!storedUser || !matchesPassword(normalizedPassword, storedUser.password_hash)) {
    throw statusError("Invalid username or password.", 401);
  }

  if (storedUser.two_factor_enabled) {
    if (!String(otp || "").trim()) {
      throw statusError("Two-factor code is required.", 401);
    }
    if (!verifyTwoFactorCode(storedUser.two_factor_secret, otp)) {
      throw statusError("Invalid two-factor code.", 401);
    }
  }

  return {
    session: sessionFromUser(storedUser),
    success: true
  };
}

async function registerAuthUser({ email, name, password, username }: any) {
  const normalized = normalizeSignup({
    email,
    name,
    password,
    role: Deno.env.get("AUTH_SIGNUP_DEFAULT_ROLE") || "user",
    username
  });
  const existingUsername = await loadUserByUsername(normalized.username);
  if (existingUsername) {
    throw statusError("Username is already registered.", 409);
  }

  const existingEmail = await loadUserByEmail(normalized.email);
  if (existingEmail) {
    throw statusError("Email is already registered.", 409);
  }

  const record = {
    email: normalized.email,
    name: normalized.name,
    password_hash: hashPassword(normalized.password),
    role: normalized.role,
    two_factor_enabled: false,
    two_factor_secret: "",
    username: normalized.username
  };
  const user = await insertUserRecord(record);

  return {
    session: sessionFromUser(user),
    success: true,
    user: publicUserFromRecord(user)
  };
}

function normalizeSignup({ email, name, password, role, username }: any) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsername(username);
  const normalizedName = String(name || normalizedUsername).trim();
  const normalizedPassword = String(password || "");
  const normalizedRole = String(role || "user").trim().toLowerCase();

  if (!normalizedName || !normalizedEmail || !normalizedUsername || !normalizedPassword) {
    throw statusError("Name, email, username, and password are required.", 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw statusError("Enter a valid email address.", 400);
  }
  if (!/^[a-z0-9._@+-]{3,80}$/.test(normalizedUsername)) {
    throw statusError("Username must be 3-80 characters and can use letters, numbers, dots, underscores, plus signs, hyphens, or @.", 400);
  }
  if (normalizedPassword.length < PASSWORD_MIN_LENGTH) {
    throw statusError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`, 400);
  }
  if (!["admin", "user"].includes(normalizedRole)) {
    throw statusError("Role must be admin or user.", 400);
  }

  return {
    email: normalizedEmail,
    name: normalizedName,
    password: normalizedPassword,
    role: normalizedRole,
    username: normalizedUsername
  };
}

async function loadUserByIdentifier(identifier: string) {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) return null;

  if (normalizedIdentifier.includes("@")) {
    return (await loadUserByEmail(normalizedIdentifier)) || loadUserByUsername(normalizedIdentifier);
  }

  return (await loadUserByUsername(normalizedIdentifier)) || loadUserByEmail(normalizedIdentifier);
}

async function loadUserByUsername(username: string) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  return loadSingleUser(`username=eq.${encodeURIComponent(normalized)}`);
}

async function loadUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return loadSingleUser(`email=eq.${encodeURIComponent(normalized)}`);
}

async function loadSingleUser(filter: string) {
  const response = await fetch(`${supabaseUrl()}/rest/v1/auth_users?${filter}&select=*`, {
    headers: supabaseHeaders()
  });
  const data = await parseSupabaseResponse(response);
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function insertUserRecord(record: Record<string, unknown>) {
  const response = await fetch(`${supabaseUrl()}/rest/v1/auth_users`, {
    method: "POST",
    headers: supabaseHeaders({ prefer: "return=representation" }),
    body: JSON.stringify(record)
  });
  const data = await parseSupabaseResponse(response);
  return data?.[0] || record;
}

function supabaseUrl() {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) {
    throw statusError("Supabase URL is not configured for the auth function.", 503);
  }
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

function supabaseServerKey() {
  const key = Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) {
    throw statusError("Supabase service key is not configured for the auth function.", 503);
  }
  return key;
}

function supabaseHeaders(options: { prefer?: string } = {}) {
  const key = supabaseServerKey();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };

  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  return headers;
}

async function parseSupabaseResponse(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw statusError(data?.message || data?.hint || `Supabase request failed with status ${response.status}.`, response.status);
  }

  return data;
}

function hashPassword(password: string) {
  if (typeof password !== "string" || !password.trim()) {
    throw statusError("Password is required.", 400);
  }

  let hash = 0x811c9dc5;
  for (let index = 0; index < password.length; index += 1) {
    hash ^= password.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function generateTwoFactorCode(secret: string, timeWindow = Date.now()) {
  const normalizedSecret = String(secret || "").trim();
  if (!normalizedSecret) {
    throw statusError("2FA secret is required.", 400);
  }

  const bucket = Math.floor(timeWindow / 30_000);
  const digest = hashPassword(`${normalizedSecret}:${bucket}`);
  const code = digest.slice(-6).toUpperCase();
  return code.replace(/[^0-9]/g, "").padStart(6, "0").slice(0, 6);
}

function verifyTwoFactorCode(secret: string, code: string, timeWindow = Date.now()) {
  if (typeof code !== "string") return false;
  const expected = generateTwoFactorCode(secret, timeWindow);
  return expected === String(code).trim().padStart(6, "0");
}

function matchesPassword(password: string, hash: string) {
  return hashPassword(password) === hash;
}

function sessionFromUser(user: any) {
  return {
    email: user.email || "",
    name: user.name || user.username,
    role: user.role || "user",
    username: user.username
  };
}

function publicUserFromRecord(user: any) {
  return {
    email: user.email || "",
    name: user.name || user.username,
    role: user.role || "user",
    username: user.username
  };
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeIdentifier(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function readJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw statusError("Request body must be valid JSON.", 400);
  }
}

function getFunctionRoute(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const functionIndex = parts.indexOf("auth");

  return functionIndex === -1 ? [] : parts.slice(functionIndex + 1);
}

function statusError(message: string, statusCode: number) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

function jsonResponse(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    },
    status
  });
}
