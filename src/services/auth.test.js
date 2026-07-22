import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, generateTwoFactorCode, signInWithSupabase, signUpWithSupabase, verifyTwoFactorCode } from "./auth.js";

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

test("local fallback is disabled unless credentials are configured", async () => {
  await withAuthEnv({}, async () => {
    await assert.rejects(
      signInWithSupabase({ username: "demo", password: "old-public-password" }),
      /Auth is not configured/
    );
  });
});

test("local fallback accepts credentials from environment", async () => {
  await withAuthEnv({ DEMO_USERNAME: "private-admin", DEMO_PASSWORD: "private-password", DEMO_NAME: "Private Admin" }, async () => {
    const session = await signInWithSupabase({ username: "private-admin", password: "private-password" });

    assert.deepEqual(session, {
      username: "private-admin",
      name: "Private Admin",
      role: "admin"
    });

    await assert.rejects(
      signInWithSupabase({ username: "demo", password: "old-public-password" }),
      /Invalid username or password/
    );
  });
});

test("localhost auth API failures can fall back to private demo credentials", async () => {
  await withAuthEnv({ DEMO_USERNAME: "private-admin", DEMO_PASSWORD: "private-password", DEMO_NAME: "Private Admin" }, async () => {
    const previousFetch = globalThis.fetch;
    const previousWindow = globalThis.window;
    const storage = new Map();

    globalThis.fetch = async () => ({
      ok: false,
      status: 503,
      text: async () => JSON.stringify({ error: "Supabase service key is not configured." })
    });
    globalThis.window = {
      location: { hostname: "127.0.0.1" },
      localStorage: {
        getItem: (key) => storage.get(key) || null,
        removeItem: (key) => storage.delete(key),
        setItem: (key, value) => storage.set(key, value)
      }
    };

    try {
      const session = await signInWithSupabase({ username: "private-admin", password: "private-password" });

      assert.deepEqual(session, {
        username: "private-admin",
        name: "Private Admin",
        role: "admin"
      });
      assert.match(storage.get("portfolio-auth"), /Private Admin/);
    } finally {
      globalThis.fetch = previousFetch;
      if (previousWindow === undefined) {
        delete globalThis.window;
      } else {
        globalThis.window = previousWindow;
      }
    }
  });
});

test("github pages signup explains the missing deployed auth backend", async () => {
  await withWindow({ location: { hostname: "shreyaanshp1.github.io" } }, async () => {
    await assert.rejects(
      signUpWithSupabase({
        email: "customer@example.com",
        name: "Customer",
        password: "customer-password",
        username: "customer"
      }),
      /Signup is not configured/
    );
  });
});

async function withAuthEnv(updates, callback) {
  const keys = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "DEMO_USERNAME", "DEMO_PASSWORD", "DEMO_NAME", "DEMO_2FA_SECRET", "DEMO_ROLE"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  for (const key of keys) {
    if (Object.hasOwn(updates, key)) {
      process.env[key] = updates[key];
    } else {
      delete process.env[key];
    }
  }

  try {
    await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

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
