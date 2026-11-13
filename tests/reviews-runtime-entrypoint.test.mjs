import test from "node:test";
import assert from "node:assert/strict";
import worker from "../server/reviews/worker.mjs";
import { onRequest } from "../functions/api/reviews/[[path]].js";
import { fixture, ORIGIN } from "./reviews-fixture.mjs";

const owners = ["kostarev.taras@gmail.com", "kostariev.taras@gmail.com"];

test("Pages service binding invokes exported Worker with ExecutionContext and cold JWKS cache", async (t) => {
  const f = await fixture();
  f.env.ACCESS_TEAM_DOMAIN = `https://runtime-${crypto.randomUUID()}.cloudflareaccess.com`;
  f.env.REVIEWS_ADMIN_EMAILS = JSON.stringify(owners);
  for (const name of ["REVIEWS_ENABLED", "REVIEWS_PHOTOS_ENABLED", "REVIEWS_NOTIFICATIONS_ENABLED", "REVIEWS_RETENTION_ENABLED"])
    f.env[name] = "false";
  let jwksCalls = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(String(url), f.env.ACCESS_TEAM_DOMAIN + "/cdn-cgi/access/certs");
    jwksCalls++;
    return f.fetcher(url, options);
  });
  const ctx = { waitUntil() { throw Error("No background work expected"); }, passThroughOnException() {} };
  const call = async (path, headers = {}, method = "GET") => onRequest({
    request: new Request(ORIGIN + "/api/reviews/admin" + path, { method, headers }),
    env: { REVIEWS_SERVICE: { fetch: request => worker.fetch(request, f.env, ctx) } },
  });
  for (const email of owners) {
    const token = await f.jwt({ email });
    const headers = { "Cf-Access-Jwt-Assertion": token };
    const response = await call("/session", headers);
    assert.equal(response.status, 200, "valid signed owner JWT through runtime entry point");
    const session = await response.json();
    assert.ok(session.csrf);
    assert.equal(session.photosEnabled, false);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal((await call("/missing", { ...headers, Origin: ORIGIN }, "POST")).status, 403, "CSRF still required");
    assert.equal((await call("/missing", { ...headers, Origin: "https://untrusted.example", "X-Review-CSRF": session.csrf }, "POST")).status, 403, "Origin still required");
  }
  assert.equal(jwksCalls, 1, "cold cache fetches JWKS once, then reuses verified keys");
  for (const claims of [
    { email: "outsider@example.test" }, { iss: "https://untrusted.example" },
    { aud: ["wrong"] }, { exp: 1 }, { nbf: Math.floor(Date.now()/1000) + 3600 },
  ]) assert.equal((await call("/session", { "Cf-Access-Jwt-Assertion": await f.jwt(claims) })).status, 403);
  assert.equal((await call("/session")).status, 403);
  const forged = (await f.jwt()).split(".");
  forged[2] = "AAAA";
  assert.equal((await call("/session", { "Cf-Access-Jwt-Assertion": forged.join(".") })).status, 403);
  const error = await (await call("/session")).json();
  assert.deepEqual(error, { error: "Owner sign-in is required." });
  assert.equal(f.calls.mail.length, 0);
  assert.equal(f.calls.turnstile, 0);
  f.sql.close();
});
