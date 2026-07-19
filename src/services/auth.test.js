import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, generateTwoFactorCode, signInWithSupabase, verifyTwoFactorCode } from "./auth.js";

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
      /local demo credentials are disabled/
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
