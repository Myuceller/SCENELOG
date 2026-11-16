import assert from "node:assert/strict";
import test from "node:test";
import { validateAuthForm, validateEmail } from "../src/lib/supabase/auth-form";

const valid = { email: "viewer@example.com", password: "test-only-password", passwordConfirm: "test-only-password" };

test("signup requires every field and rejects mismatched confirmation", () => {
  assert.deepEqual(Object.keys(validateAuthForm("signup", { email: "", password: "", passwordConfirm: "" })), ["email", "password", "passwordConfirm"]);
  assert.ok(validateAuthForm("signup", { ...valid, passwordConfirm: "different-password" }).passwordConfirm);
  assert.ok(validateAuthForm("signup", { ...valid, passwordConfirm: "" }).passwordConfirm);
  assert.deepEqual(validateAuthForm("signup", valid), {});
});

test("signup respects password length boundaries and compares without trimming", () => {
  for (const length of [7, 129]) {
    const password = "x".repeat(length);
    assert.ok(validateAuthForm("signup", { ...valid, password, passwordConfirm: password }).password);
  }
  for (const length of [8, 128]) {
    const password = "x".repeat(length);
    assert.deepEqual(validateAuthForm("signup", { ...valid, password, passwordConfirm: password }), {});
  }
  assert.ok(validateAuthForm("signup", { ...valid, passwordConfirm: `${valid.password} ` }).passwordConfirm);
});

test("login does not require confirmation or impose new signup minimum on existing passwords", () => {
  assert.deepEqual(validateAuthForm("login", { ...valid, password: "short", passwordConfirm: "" }), {});
  assert.ok(validateAuthForm("login", { ...valid, password: "" }).password);
});

test("email validation handles whitespace and invalid reset/signup addresses", () => {
  assert.equal(validateEmail("  viewer+film@example.com  "), undefined);
  for (const email of ["", " ", "viewer", "viewer@", "viewer@@example.com", "view er@example.com", "viewer@example", `${"x".repeat(250)}@example.com`]) {
    assert.ok(validateEmail(email));
  }
});
