import { generateTwoFactorCode, hashPassword, verifyTwoFactorCode } from "./password.js";

const AUTH_STORAGE_KEY = "portfolio-auth";
const CONFIGURED_AUTH_ENDPOINT = trimTrailingSlash(import.meta.env?.VITE_AUTH_ENDPOINT || "");
const CONFIGURED_PURCHASE_ENDPOINT = import.meta.env?.VITE_PURCHASE_LOG_ENDPOINT || "";
const PURCHASE_ENDPOINT = CONFIGURED_PURCHASE_ENDPOINT || "/api/purchases";
const API_ROOT = PURCHASE_ENDPOINT.replace(/\/purchases\/?$/, "") || "/api";
const AUTH_API_ROOT = CONFIGURED_AUTH_ENDPOINT || `${API_ROOT}/auth`;

export { generateTwoFactorCode, hashPassword, verifyTwoFactorCode };

export async function unlockDashboardWithPassword({ password }) {
  if (!password) {
    throw new Error("Password is required.");
  }

  if (!shouldUseAuthApi()) {
    throw new Error("Dashboard password requires the private auth API.");
  }

  const result = await postAuthJson("password", { password });
  const session = result.session;
  persistAuthSession(session);
  return session;
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

export async function signInWithSupabase() {
  throw disabledAuthFeatureError("Username login is disabled.");
}

export async function registerUserInSupabase() {
  throw disabledAuthFeatureError("Signup is disabled.");
}

export async function signUpWithSupabase() {
  throw disabledAuthFeatureError("Signup is disabled.");
}

export async function requestPasswordReset() {
  throw disabledAuthFeatureError("Password reset is disabled.");
}

export async function resetPassword() {
  throw disabledAuthFeatureError("Password reset is disabled.");
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
  return !isGitHubPages();
}

function isGitHubPages() {
  return typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
}

function trimTrailingSlash(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function disabledAuthFeatureError(message) {
  const error = new Error(message);
  error.statusCode = 410;
  return error;
}
