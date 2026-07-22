import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, generateTwoFactorCode, signInWithSupabase, signUpWithSupabase, unlockDashboardWithPassword, verifyTwoFactorCode } from "./auth.js";

test("hashPassword returns a stable digest for the same password", () => {
  const first = hashPassword("secret-password");
  const second = hashPassword("secret-password");

  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{8}$/);
});

test("two-factor code generation accepts the same time window and rejects others", () => {
  const secret = "demo-secret";
  const windowStart = 1_700_000_000_000;
  const code = generateTwoFactorCode(secret, windowStart);

  assert.equal(code.length, 6);
  assert.equal(verifyTwoFactorCode(secret, code, windowStart), true);
  assert.equal(verifyTwoFactorCode(secret, code, windowStart + 60_000), false);
  assert.equal(verifyTwoFactorCode(secret, "000000", windowStart), false);
});

test("dashboard password unlocks through the auth API and persists the admin session", async () => {
  await withWindow({ location: { hostname: "127.0.0.1" } }, async () => {
    const previousFetch = globalThis.fetch;
    const storage = new Map();
    globalThis.window.localStorage = {
      getItem: (key) => storage.get(key) || null,
      removeItem: (key) => storage.delete(key),
      setItem: (key, value) => storage.set(key, value)
    };

    globalThis.fetch = async (url, options) => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        session: { name: "Dashboard Admin", role: "admin", username: "dashboard-admin" },
        success: true,
        url,
        method: options?.method
      })
    });

    try {
      const session = await unlockDashboardWithPassword({ password: "private-password" });

      assert.deepEqual(session, {
        username: "dashboard-admin",
        name: "Dashboard Admin",
        role: "admin"
      });
      assert.match(storage.get("portfolio-auth"), /Dashboard Admin/);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});

test("dashboard password rejects auth API failures", async () => {
  await withWindow({ location: { hostname: "127.0.0.1" }, localStorage: memoryStorage() }, async () => {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "Invalid dashboard password." })
    });

    try {
      await assert.rejects(
        unlockDashboardWithPassword({ password: "wrong-password" }),
        /Invalid dashboard password/
      );
    } finally {
      globalThis.fetch = previousFetch;
    }
  });
});

test("legacy username auth and signup are disabled", async () => {
  await assert.rejects(
    signInWithSupabase({
      password: "customer-password",
      username: "customer"
    }),
    /Username login is disabled/
  );

  await assert.rejects(
    signUpWithSupabase({
      email: "customer@example.com",
      name: "Customer",
      password: "customer-password",
      username: "customer"
    }),
    /Signup is disabled/
  );
});

async function withWindow(windowValue, callback) {
  const previousWindow = globalThis.window;
  globalThis.window = windowValue;

  try {
    await callback();
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
}

function memoryStorage() {
  const storage = new Map();

  return {
    getItem: (key) => storage.get(key) || null,
    removeItem: (key) => storage.delete(key),
    setItem: (key, value) => storage.set(key, value)
  };
}
