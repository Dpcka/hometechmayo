import { ReviewError, hmac } from "./policy.mjs";
const cache = new Map();
const decode = (part) =>
  Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
    c.charCodeAt(0),
  );
export async function authenticate(request, env, fetcher = fetch) {
  try {
    const issuer = env.ACCESS_TEAM_DOMAIN;
    if (
      !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer || "") ||
      !env.ACCESS_AUD ||
      !env.REVIEWS_ADMIN_EMAIL
    )
      throw Error();
    const token = request.headers.get("Cf-Access-Jwt-Assertion") || "";
    if (token.length > 16384) throw Error();
    const parts = token.split(".");
    if (parts.length !== 3) throw Error();
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0]))),
      payload = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    if (header.alg !== "RS256" || typeof header.kid !== "string") throw Error();
    let entry = cache.get(issuer);
    if (
      !entry ||
      entry.until < Date.now() ||
      (!entry.keys.some((k) => k.kid === header.kid) &&
        entry.fetchedAt < Date.now() - 10000)
    ) {
      const response = await fetcher(issuer + "/cdn-cgi/access/certs", {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw Error();
      const { keys } = await response.json();
      if (!Array.isArray(keys) || keys.length > 20) throw Error();
      entry = { keys, until: Date.now() + 300000, fetchedAt: Date.now() };
      cache.set(issuer, entry);
    }
    const jwk = entry.keys.find((k) => k.kid === header.kid && k.kty === "RSA");
    if (!jwk) throw Error();
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    if (
      !(await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        decode(parts[2]),
        new TextEncoder().encode(parts[0] + "." + parts[1]),
      ))
    )
      throw Error();
    const now = Math.floor(Date.now() / 1000),
      aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (
      payload.iss !== issuer ||
      !aud.includes(env.ACCESS_AUD) ||
      !Number.isFinite(payload.exp) ||
      payload.exp <= now ||
      (payload.nbf && payload.nbf > now) ||
      payload.email?.toLowerCase() !== env.REVIEWS_ADMIN_EMAIL.toLowerCase() ||
      !payload.sub
    )
      throw Error();
    return {
      email: payload.email.toLowerCase(),
      sub: payload.sub,
      csrf: await hmac(env.REVIEWS_HASH_SECRET, "csrf:" + token),
    };
  } catch {
    throw new ReviewError("Owner sign-in is required.", 403);
  }
}
export async function protectAdminPage({ request, env, next }) {
  if (!env.REVIEWS_HASH_SECRET)
    return new Response("Reviews administration is not configured.", {
      status: 503,
    });
  try {
    await authenticate(request, env);
    const response = await next();
    const result = new Response(response.body, response);
    result.headers.set("Cache-Control", "no-store");
    result.headers.set("X-Robots-Tag", "noindex, nofollow");
    return result;
  } catch {
    return new Response("Owner sign-in is required.", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
