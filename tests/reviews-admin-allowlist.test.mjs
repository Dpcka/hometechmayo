import test from "node:test";
import assert from "node:assert/strict";
import { fixture, ORIGIN } from "./reviews-fixture.mjs";
import {
  administratorEmails,
  protectAdminPage,
} from "../server/reviews/auth.mjs";

const owners = ["kostarev.taras@gmail.com", "kostariev.taras@gmail.com"];

test("both approved accounts pass Worker and Pages authentication; Origin and token-bound CSRF remain required", async () => {
  const f = await fixture();
  f.env.REVIEWS_ADMIN_EMAILS = JSON.stringify(owners);
  f.env.REVIEWS_ENABLED = "false";
  for (const email of owners) {
    const token = await f.jwt({ email });
    const headers = { "Cf-Access-Jwt-Assertion": token };
    const session = await f.call("/admin/session", { headers });
    assert.equal(session.status, 200, email);
    assert.equal(
      (await f.call("/admin/readiness", { headers })).data
        .authenticationConfigured,
      true,
    );
    const page = await protectAdminPage({
      request: new Request(ORIGIN + "/admin/reviews", { headers }),
      env: f.env,
      next: () => new Response("Owner administration"),
    });
    assert.equal(page.status, 200, email);
    assert.equal(page.headers.get("Cache-Control"), "no-store");
    assert.equal(
      (
        await f.call("/admin/00000000-0000-4000-8000-000000000000", {
          method: "POST",
          headers,
          body: {},
        })
      ).status,
      403,
      "missing CSRF rejected for each owner",
    );
    assert.equal(
      (
        await f.call("/admin/00000000-0000-4000-8000-000000000000", {
          method: "POST",
          headers: { ...headers, "X-Review-CSRF": session.data.csrf },
          origin: "https://untrusted.example",
          body: {},
        })
      ).status,
      403,
      "foreign origin rejected for each owner",
    );
    for (const invalid of [
      { email, aud: ["wrong"] },
      { email, exp: 1 },
    ]) {
      assert.equal(
        (
          await f.call("/admin/session", {
            headers: { "Cf-Access-Jwt-Assertion": await f.jwt(invalid) },
          })
        ).status,
        403,
      );
    }
  }
});

test("other addresses, aliases and substring matches are denied by both Worker and Pages", async () => {
  const f = await fixture();
  f.env.REVIEWS_ADMIN_EMAILS = JSON.stringify(owners);
  // Warm this issuer's verified JWKS cache for Pages' normal fetch path.
  await f.call("/admin/session", {
    headers: { "Cf-Access-Jwt-Assertion": await f.jwt({ email: owners[0] }) },
  });
  for (const email of [
    "intruder@example.test",
    "kostarev.taras+other@gmail.com",
    "xkostarev.taras@gmail.com",
    "kostariev.taras@gmail.com.evil.test",
  ]) {
    const headers = { "Cf-Access-Jwt-Assertion": await f.jwt({ email }) };
    assert.equal((await f.call("/admin/session", { headers })).status, 403);
    assert.equal(
      (
        await protectAdminPage({
          request: new Request(ORIGIN + "/admin/reviews", { headers }),
          env: f.env,
          next: () => {
            throw Error("Must not serve the page");
          },
        })
      ).status,
      403,
    );
  }
});

test("allowlist requires exactly two distinct valid addresses and never falls back to singular configuration", async () => {
  for (const value of [
    undefined,
    "not JSON",
    "[]",
    JSON.stringify([owners[0]]),
    JSON.stringify([...owners, "third@example.test"]),
    JSON.stringify([owners[0], owners[0].toUpperCase()]),
    JSON.stringify([owners[0], "*@gmail.com"]),
    JSON.stringify([owners[0], 42]),
  ]) {
    const f = await fixture();
    const signedOwnerToken = await f.jwt({ email: owners[0] });
    f.env.REVIEWS_ADMIN_EMAILS = value;
    f.env.REVIEWS_ADMIN_EMAIL = owners[0];
    assert.deepEqual(administratorEmails(f.env), []);
    assert.equal(
      (
        await f.call("/admin/session", {
          headers: {
            "Cf-Access-Jwt-Assertion": signedOwnerToken,
          },
        })
      ).status,
      403,
    );
  }
  assert.deepEqual(
    administratorEmails({
      REVIEWS_ADMIN_EMAILS: JSON.stringify(
        owners.map((v) => " " + v.toUpperCase() + " "),
      ),
    }),
    owners,
  );
});
