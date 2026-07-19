import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, generateTwoFactorCode, verifyTwoFactorCode } from "./auth.js";

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
