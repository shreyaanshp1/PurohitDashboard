import { generateTwoFactorCode, hashPassword, verifyTwoFactorCode } from "./password.js";

const AUTH_STORAGE_KEY = "portfolio-auth";
const DEFAULT_LOCAL_AUTH_NAME = "Local Admin";
const CONFIGURED_AUTH_ENDPOINT = trimTrailingSlash(import.meta.env?.VITE_AUTH_ENDPOINT || "");
const CONFIGURED_PURCHASE_ENDPOINT = import.meta.env?.VITE_PURCHASE_LOG_ENDPOINT || "";
const DEV_DEMO_USERNAME = typeof __DEV_DEMO_USERNAME__ !== "undefined" ? __DEV_DEMO_USERNAME__ : "";
const DEV_DEMO_PASSWORD = typeof __DEV_DEMO_PASSWORD__ !== "undefined" ? __DEV_DEMO_PASSWORD__ : "";
const DEV_DEMO_2FA_SECRET = typeof __DEV_DEMO_2FA_SECRET__ !== "undefined" ? __DEV_DEMO_2FA_SECRET__ : "";
const DEV_DEMO_NAME = typeof __DEV_DEMO_NAME__ !== "undefined" ? __DEV_DEMO_NAME__ : "";
const DEV_DEMO_ROLE = typeof __DEV_DEMO_ROLE__ !== "undefined" ? __DEV_DEMO_ROLE__ : "";
const BROWSER_SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "";
const BROWSER_SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";
const PURCHASE_ENDPOINT = CONFIGURED_PURCHASE_ENDPOINT || "/api/purchases";
const API_ROOT = PURCHASE_ENDPOINT.replace(/\/purchases\/?$/, "") || "/api";
const AUTH_API_ROOT = CONFIGURED_AUTH_ENDPOINT || `${API_ROOT}/auth`;

export { generateTwoFactorCode, hashPassword, verifyTwoFactorCode };

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
  const localUser = localAuthUser();

  if (shouldUseAuthApi()) {
    try {
      const result = await postAuthJson("signin", { username: normalizedUsername, password, otp });
      const session = result.session;
      persistAuthSession(session);
      return session;
    } catch (error) {
      if (!shouldUseLocalAuthFallback(error, localUser)) {
        throw error;
      }
    }
  }

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

export async function registerUserInSupabase({ username, email = "", password, otpSecret, name, role = "user" }) {
  if (!username || !password) {
    throw new Error("Username and password are required.");
  }

  if (shouldUseAuthApi()) {
    const result = await postAuthJson("signup", { username, email, password, name, role });
    const session = result.session;
    persistAuthSession(session);
    return result.user || session;
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
    email: String(email || "").trim().toLowerCase(),
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

export async function signUpWithSupabase({ username, email, password, name }) {
  if (!username || !email || !password) {
    throw new Error("Name, email, username, and password are required.");
  }

  if (shouldUseAuthApi()) {
    const result = await postAuthJson("signup", { username, email, password, name });
    const session = result.session;
    persistAuthSession(session);
    return session;
  }

  return registerUserInSupabase({ email, username, password, name });
}

export async function requestPasswordReset({ identifier, resetUrlBase }) {
  if (!identifier) {
    throw new Error("Username or email is required.");
  }

  if (!shouldUseAuthApi()) {
    throw new Error("Password reset requires the auth API. Start the local API server or configure VITE_AUTH_ENDPOINT.");
  }

  return postAuthJson("password-reset/request", { identifier, resetUrlBase });
}

export async function resetPassword({ token, password }) {
  if (!token || !password) {
    throw new Error("Reset token and new password are required.");
  }

  if (!shouldUseAuthApi()) {
    throw new Error("Password reset requires the auth API. Start the local API server or configure VITE_AUTH_ENDPOINT.");
  }

  return postAuthJson("password-reset/confirm", { token, password });
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
    throw new Error(authConfigurationMessage());
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
  const username = localAuthValue(DEV_DEMO_USERNAME, "DEMO_USERNAME").trim().toLowerCase();
  const password = localAuthValue(DEV_DEMO_PASSWORD, "DEMO_PASSWORD");
  if (!username || !password.trim()) return null;

  const twoFactorSecret = localAuthValue(DEV_DEMO_2FA_SECRET, "DEMO_2FA_SECRET").trim();
  return {
    username,
    name: localAuthValue(DEV_DEMO_NAME, "DEMO_NAME").trim() || DEFAULT_LOCAL_AUTH_NAME,
    password_hash: hashPassword(password.trim()),
    two_factor_enabled: Boolean(twoFactorSecret),
    two_factor_secret: twoFactorSecret,
    role: localAuthValue(DEV_DEMO_ROLE, "DEMO_ROLE").trim() || "admin"
  };
}

function localAuthValue(viteValue, processKey) {
  return viteValue || localProcessAuthValue(processKey);
}

function localProcessAuthValue(processKey) {
  if (typeof process === "undefined" || !process.env) return "";
  return process.env[processKey] || process.env[`VITE_${processKey}`] || "";
}

function hasSupabaseConfig() {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}

function supabaseUrl() {
  const url = BROWSER_SUPABASE_URL || (typeof process !== "undefined" && process.env ? process.env.SUPABASE_URL : "") || "";
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

function supabaseAnonKey() {
  return BROWSER_SUPABASE_ANON_KEY || (typeof process !== "undefined" && process.env ? process.env.SUPABASE_ANON_KEY : "") || "";
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

async function postAuthJson(path, payload) {
  const response = await fetch(`${AUTH_API_ROOT}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  const body = parseJsonResponse(text, response);

  if (!response.ok || body?.success === false) {
    const error = new Error(body?.error || body?.message || `Auth request failed with status ${response.status}.`);
    error.statusCode = response.status;
    throw error;
  }

  return body;
}

function parseJsonResponse(text, response) {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    const isHtml = /<!doctype html|<html[\s>]/i.test(text);
    const detail = isHtml ? "HTML" : "a non-JSON response";
    throw new Error(`Auth API returned ${detail} for ${response.url}. Check the auth endpoint configuration.`);
  }
}

function shouldUseAuthApi() {
  if (typeof window === "undefined") return false;
  if (CONFIGURED_AUTH_ENDPOINT || CONFIGURED_PURCHASE_ENDPOINT) return true;
  return !window.location.hostname.endsWith("github.io");
}

function shouldUseLocalAuthFallback(error, localUser) {
  if (!localUser || !isLocalBrowser()) return false;
  if (CONFIGURED_AUTH_ENDPOINT || CONFIGURED_PURCHASE_ENDPOINT) return false;

  const message = String(error?.message || "");
  return [401, 503].includes(error?.statusCode) || /Failed to fetch|NetworkError|Auth API returned HTML|status 404|status 502|status 503/i.test(message);
}

function isLocalBrowser() {
  if (typeof window === "undefined") return false;
  return ["127.0.0.1", "localhost"].includes(window.location.hostname);
}

function authConfigurationMessage() {
  if (typeof window !== "undefined" && window.location.hostname.endsWith("github.io")) {
    return "Auth backend is not configured for this deployment. Set GitHub repository variables VITE_AUTH_ENDPOINT or VITE_PURCHASE_LOG_ENDPOINT to your private backend URL, then redeploy.";
  }

  return "Auth is not configured in this frontend. Restart npm run dev after setting local demo credentials in .env.local, or configure VITE_AUTH_ENDPOINT.";
}

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/$/, "");
}
