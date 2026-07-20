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
