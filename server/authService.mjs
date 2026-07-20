import crypto from "node:crypto";
import { hashPassword, verifyTwoFactorCode } from "../src/services/password.js";
import { sendPasswordResetEmail } from "./emailSender.mjs";
import { parseSupabaseResponse, supabaseHeaders, supabaseUrl } from "./supabaseClient.mjs";

const PASSWORD_MIN_LENGTH = 8;
const DEFAULT_RESET_TOKEN_TTL_MINUTES = 60;

export async function signInAuthUser({ otp = "", password, username }) {
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

export async function registerAuthUser({ email, name, password, username }) {
  const normalized = normalizeSignup({
    email,
    name,
    password,
    role: process.env.AUTH_SIGNUP_DEFAULT_ROLE || "user",
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

export async function requestAuthPasswordReset({ identifier, resetUrlBase }) {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) {
    throw statusError("Username or email is required.", 400);
  }

  const user = await loadUserByIdentifier(normalizedIdentifier);
  if (!user) {
    return { success: true };
  }

  const email = normalizeEmail(user.email || (String(user.username || "").includes("@") ? user.username : ""));
  if (!email) {
    throw statusError("This account does not have an email address for password resets.", 400);
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);
  const ttlMinutes = resetTokenTtlMinutes();
  const expiresAt = new Date(Date.now() + resetTokenTtlMs()).toISOString();
  const resetUrl = buildResetUrl({ resetUrlBase, token });

  await updateUserRecord(user.id, {
    password_reset_expires_at: expiresAt,
    password_reset_requested_at: new Date().toISOString(),
    password_reset_token_hash: tokenHash,
    updated_at: new Date().toISOString()
  });

  const emailResult = await sendPasswordResetEmail({
    expiresInMinutes: ttlMinutes,
    name: user.name || user.username,
    resetUrl,
    to: email
  });

  return {
    emailSent: Boolean(emailResult.sent),
    maskedEmail: maskEmail(email),
    success: true
  };
}

export async function confirmAuthPasswordReset({ password, token }) {
  const normalizedToken = String(token || "").trim();
  const normalizedPassword = String(password || "");

  if (!normalizedToken || !normalizedPassword) {
    throw statusError("Reset token and new password are required.", 400);
  }
  if (normalizedPassword.length < PASSWORD_MIN_LENGTH) {
    throw statusError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`, 400);
  }

  const user = await loadUserByResetTokenHash(hashResetToken(normalizedToken));
  if (!user || !user.password_reset_expires_at || new Date(user.password_reset_expires_at).getTime() < Date.now()) {
    throw statusError("Reset link is invalid or expired.", 400);
  }

  await updateUserRecord(user.id, {
    password_hash: hashPassword(normalizedPassword),
    password_reset_expires_at: null,
    password_reset_requested_at: null,
    password_reset_token_hash: null,
    updated_at: new Date().toISOString()
  });

  return { success: true };
}

function normalizeSignup({ email, name, password, role, username }) {
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

async function loadUserByIdentifier(identifier) {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  if (!normalizedIdentifier) return null;

  if (normalizedIdentifier.includes("@")) {
    return (await loadUserByEmail(normalizedIdentifier)) || loadUserByUsername(normalizedIdentifier);
  }

  return (await loadUserByUsername(normalizedIdentifier)) || loadUserByEmail(normalizedIdentifier);
}

async function loadUserByUsername(username) {
  return loadSingleUser(`username=eq.${encodeURIComponent(normalizeUsername(username))}`);
}

async function loadUserByEmail(email) {
  return loadSingleUser(`email=eq.${encodeURIComponent(normalizeEmail(email))}`);
}

async function loadUserByResetTokenHash(tokenHash) {
  return loadSingleUser(`password_reset_token_hash=eq.${encodeURIComponent(tokenHash)}`);
}

async function loadSingleUser(filter) {
  if (!filter) return null;

  const url = `${supabaseUrl()}/rest/v1/auth_users?${filter}&select=*`;
  const response = await fetch(url, { headers: supabaseHeaders() });
  const data = await parseSupabaseResponse(response);
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function insertUserRecord(record) {
  const response = await fetch(`${supabaseUrl()}/rest/v1/auth_users`, {
    method: "POST",
    headers: supabaseHeaders({ prefer: "return=representation" }),
    body: JSON.stringify(record)
  });
  const data = await parseSupabaseResponse(response);
  return data?.[0] || record;
}

async function updateUserRecord(id, values) {
  const response = await fetch(`${supabaseUrl()}/rest/v1/auth_users?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: supabaseHeaders({ prefer: "return=representation" }),
    body: JSON.stringify(values)
  });
  const data = await parseSupabaseResponse(response);
  return data?.[0] || null;
}

function buildResetUrl({ resetUrlBase, token }) {
  const base = String(resetUrlBase || process.env.PASSWORD_RESET_APP_URL || process.env.APP_BASE_URL || "").trim();
  if (!base) {
    throw statusError("Password reset URL is not configured.", 503);
  }

  const resetUrl = new URL(base);
  resetUrl.searchParams.set("resetToken", token);
  return resetUrl.href;
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

function matchesPassword(password, hash) {
  return hashPassword(password) === hash;
}

function sessionFromUser(user) {
  return {
    email: user.email || "",
    name: user.name || user.username,
    role: user.role || "user",
    username: user.username
  };
}

function publicUserFromRecord(user) {
  return {
    email: user.email || "",
    name: user.name || user.username,
    role: user.role || "user",
    username: user.username
  };
}

function maskEmail(email) {
  const [localPart, domain] = String(email || "").split("@");
  if (!localPart || !domain) return "";
  const first = localPart.slice(0, 1);
  const last = localPart.length > 2 ? localPart.slice(-1) : "";
  return `${first}${"*".repeat(Math.max(localPart.length - 2, 2))}${last}@${domain}`;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function resetTokenTtlMs() {
  return Math.max(5, resetTokenTtlMinutes()) * 60_000;
}

function resetTokenTtlMinutes() {
  return Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || DEFAULT_RESET_TOKEN_TTL_MINUTES);
}

function statusError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
