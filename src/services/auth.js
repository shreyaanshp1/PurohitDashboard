const AUTH_STORAGE_KEY = "portfolio-auth";
const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const DEFAULT_LOCAL_AUTH_NAME = "Local Admin";

export function hashPassword(password) {
  if (typeof password !== "string" || !password.trim()) {
    throw new Error("Password is required.");
  }

  let hash = 0x811c9dc5;
  for (let index = 0; index < password.length; index += 1) {
    hash ^= password.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function generateTwoFactorCode(secret, timeWindow = Date.now()) {
  const normalizedSecret = String(secret || "").trim();
  if (!normalizedSecret) {
    throw new Error("2FA secret is required.");
  }

  const bucket = Math.floor(timeWindow / 30_000);
  const digest = hashPassword(`${normalizedSecret}:${bucket}`);
  const code = digest.slice(-6).toUpperCase();
  return code.replace(/[^0-9]/g, "").padStart(6, "0").slice(0, 6);
}

export function verifyTwoFactorCode(secret, code, timeWindow = Date.now()) {
  if (typeof code !== "string") return false;
  const expected = generateTwoFactorCode(secret, timeWindow);
  return expected === String(code).trim().padStart(6, "0");
}

export function persistAuthSession(session) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function readAuthSession() {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function signInWithSupabase({ username, password, otp }) {
  if (!username || !password) {
    throw new Error("Username and password are required.");
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  if (!hasSupabaseConfig()) {
    return signInWithLocalFallback({ username: normalizedUsername, password, otp });
  }

  const storedUser = await loadUserFromSupabase(normalizedUsername);
  if (!storedUser) {
    throw new Error("User not found. Create the user record in Supabase first.");
  }

  if (!matchesPassword(password, storedUser.password_hash)) {
    throw new Error("Invalid password.");
  }

  if (storedUser.two_factor_enabled) {
    if (!String(otp || "").trim()) {
      throw new Error("Two-factor code is required.");
    }
    if (!verifyTwoFactorCode(storedUser.two_factor_secret, otp)) {
      throw new Error("Invalid two-factor code.");
    }
  }

  const session = {
    username: storedUser.username,
    name: storedUser.name || storedUser.username,
    role: storedUser.role || "user"
  };
  persistAuthSession(session);
  return session;
}

export async function registerUserInSupabase({ username, password, otpSecret, name, role = "user" }) {
  if (!username || !password) {
    throw new Error("Username and password are required.");
  }

  if (!hasSupabaseConfig()) {
    throw new Error("Supabase environment variables are not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.");
  }

  const normalizedUsername = String(username).trim().toLowerCase();
  const existing = await loadUserFromSupabase(normalizedUsername);
  if (existing) {
    throw new Error("Username is already registered.");
  }

  const record = {
    username: normalizedUsername,
    name: String(name || normalizedUsername).trim(),
    password_hash: hashPassword(password),
    two_factor_enabled: Boolean(otpSecret),
    two_factor_secret: String(otpSecret || "").trim(),
    role
  };

  await upsertUserRecord(record);
  return record;
}

async function loadUserFromSupabase(username) {
  const url = `${supabaseUrl()}/rest/v1/auth_users?username=eq.${encodeURIComponent(username)}&select=*`;
  const response = await fetch(url, { headers: supabaseHeaders() });
  const data = await parseSupabaseResponse(response);
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function upsertUserRecord(record) {
  const response = await fetch(`${supabaseUrl()}/rest/v1/auth_users?on_conflict=username`, {
    method: "POST",
    headers: supabaseHeaders({ prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(record)
  });
  await parseSupabaseResponse(response);
}

function matchesPassword(password, hash) {
  return hashPassword(password) === hash;
}

function signInWithLocalFallback({ username, password, otp }) {
  const localUser = localAuthUser();
  if (!localUser) {
    throw new Error("Supabase is not configured and local demo credentials are disabled. Configure Supabase or set VITE_DEMO_USERNAME and VITE_DEMO_PASSWORD in .env.local.");
  }

  const normalizedUsername = String(username || "").trim().toLowerCase();
  const normalizedPassword = String(password || "").trim();
  if (normalizedUsername !== localUser.username || !matchesPassword(normalizedPassword, localUser.password_hash)) {
    throw new Error("Invalid username or password.");
  }

  if (localUser.two_factor_enabled && String(otp || "").trim() && !verifyTwoFactorCode(localUser.two_factor_secret, otp)) {
    throw new Error("Invalid two-factor code.");
  }

  const session = {
    username: localUser.username,
    name: localUser.name,
    role: localUser.role
  };
  persistAuthSession(session);
  return session;
}

function localAuthUser() {
  const username = localAuthValue("VITE_DEMO_USERNAME", "DEMO_USERNAME").trim().toLowerCase();
  const password = localAuthValue("VITE_DEMO_PASSWORD", "DEMO_PASSWORD");
  if (!username || !password.trim()) return null;

  const twoFactorSecret = localAuthValue("VITE_DEMO_2FA_SECRET", "DEMO_2FA_SECRET").trim();
  return {
    username,
    name: localAuthValue("VITE_DEMO_NAME", "DEMO_NAME").trim() || DEFAULT_LOCAL_AUTH_NAME,
    password_hash: hashPassword(password.trim()),
    two_factor_enabled: Boolean(twoFactorSecret),
    two_factor_secret: twoFactorSecret,
    role: localAuthValue("VITE_DEMO_ROLE", "DEMO_ROLE").trim() || "admin"
  };
}

function localAuthValue(viteKey, processKey) {
  return env[viteKey] || (typeof process !== "undefined" && process.env ? process.env[processKey] : "") || "";
}

function hasSupabaseConfig() {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

function supabaseUrl() {
  const url = env.VITE_SUPABASE_URL || (typeof process !== "undefined" && process.env ? process.env.SUPABASE_URL : "") || "";
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

function supabaseAnonKey() {
  return env.VITE_SUPABASE_ANON_KEY || (typeof process !== "undefined" && process.env ? process.env.SUPABASE_ANON_KEY : "") || "";
}

function supabaseHeaders() {
  const key = supabaseAnonKey();
  if (!key) throw new Error("Missing VITE_SUPABASE_ANON_KEY.");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
}

async function parseSupabaseResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || `Supabase request failed with status ${response.status}.`);
  }
  return data;
}
