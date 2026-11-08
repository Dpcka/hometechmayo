import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { handleReviews } from "../server/reviews/worker.mjs";
export const ORIGIN = "https://hometechmayo.ie";
const encoder = new TextEncoder();
const b64 = (value) =>
  Buffer.from(
    typeof value === "string" ? value : JSON.stringify(value),
  ).toString("base64url");
export async function fixture() {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys=ON");
  sql.exec(
    readFileSync(
      new URL("../server/reviews/migrations/0001-reviews.sql", import.meta.url),
      "utf8",
    ),
  );
  sql.exec(
    readFileSync(
      new URL(
        "../server/reviews/migrations/0002-retention.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  function statement(query, args = []) {
    return {
      bind(...next) {
        return statement(query, next);
      },
      first: async () => sql.prepare(query).get(...args) || null,
      all: async () => ({ results: sql.prepare(query).all(...args) }),
      run: async () => ({
        meta: { changes: Number(sql.prepare(query).run(...args).changes) },
      }),
      execute() {
        return {
          meta: { changes: Number(sql.prepare(query).run(...args).changes) },
        };
      },
    };
  }
  const db = {
    prepare: statement,
    batch: async (statements) => {
      sql.exec("BEGIN");
      try {
        const result = statements.map((s) => s.execute());
        sql.exec("COMMIT");
        return result;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const objects = new Map(),
    bucket = {
      put: async (key, bytes) => objects.set(key, new Uint8Array(bytes)),
      get: async (key) =>
        objects.has(key) ? { body: objects.get(key) } : null,
      delete: async (key) => objects.delete(key),
      list: async ({ prefix, limit = 1000 }) => ({
        objects: [...objects.keys()]
          .filter((k) => k.startsWith(prefix))
          .slice(0, limit)
          .map((key) => ({ key })),
      }),
    };
  const read = async (stream) =>
    Buffer.from(await new Response(stream).arrayBuffer());
  const images = {
    info: async (stream) => {
      const m = await sharp(await read(stream), {
        limitInputPixels: 40000000,
      }).metadata();
      return { format: m.format, width: m.width, height: m.height };
    },
    input(stream) {
      let transform;
      return {
        transform(options) {
          transform = options;
          return this;
        },
        async output() {
          const bytes = await sharp(await read(stream), {
            limitInputPixels: 40000000,
          })
            .rotate()
            .resize({ width: transform.width, withoutEnlargement: true })
            .webp()
            .toBuffer();
          return {
            response: () =>
              new Response(bytes, {
                headers: { "Content-Type": "image/webp" },
              }),
          };
        },
      };
    },
  };
  const keys = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = {
    ...(await crypto.subtle.exportKey("jwk", keys.publicKey)),
    kid: crypto.randomUUID(),
  };
  const env = {
    REVIEWS_DB: db,
    REVIEWS_MEDIA: bucket,
    IMAGES: images,
    REVIEWS_ENABLED: "true",
    REVIEWS_NOTIFICATIONS_ENABLED: "true",
    REVIEWS_PHOTOS_ENABLED: "true",
    REVIEWS_HASH_SECRET: "test-only-review-secret-32-characters",
    TURNSTILE_SECRET_KEY: "fake-turnstile",
    TURNSTILE_SITE_KEY: "fake-public-key",
    SITE_ORIGIN: ORIGIN,
    BREVO_API_KEY: "fake-brevo",
    REVIEWS_FROM_EMAIL: "info@hometechmayo.ie",
    REVIEWS_TO_EMAIL: "info@hometechmayo.ie",
    ACCESS_TEAM_DOMAIN: `https://test-${crypto.randomUUID()}.cloudflareaccess.com`,
    ACCESS_AUD: "test-audience",
    REVIEWS_ADMIN_EMAIL: "owner@example.test",
  };
  const calls = { mail: [], turnstile: 0 };
  let mailFails = false,
    turnstileResult = {
      success: true,
      action: "review",
      hostname: "hometechmayo.ie",
    };
  const fetcher = async (url, options) => {
    if (String(url).endsWith("/cdn-cgi/access/certs"))
      return Response.json({ keys: [jwk] });
    if (String(url).includes("/siteverify")) {
      calls.turnstile++;
      return Response.json(turnstileResult);
    }
    if (String(url) === "https://api.brevo.com/v3/smtp/email") {
      calls.mail.push(JSON.parse(options.body));
      return mailFails
        ? new Response("mock failure", { status: 500 })
        : Response.json({ messageId: "mock-only" });
    }
    throw Error("Unexpected external fetch");
  };
  async function jwt(overrides = {}) {
    const header = b64({ alg: "RS256", kid: jwk.kid }),
      payload = b64({
        iss: env.ACCESS_TEAM_DOMAIN,
        aud: [env.ACCESS_AUD],
        exp: Math.floor(Date.now() / 1000) + 3600,
        sub: "owner-test",
        email: env.REVIEWS_ADMIN_EMAIL,
        ...overrides,
      });
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      keys.privateKey,
      encoder.encode(header + "." + payload),
    );
    return (
      header +
      "." +
      payload +
      "." +
      Buffer.from(signature).toString("base64url")
    );
  }
  const token = await jwt();
  async function call(
    path = "",
    {
      method = "GET",
      body,
      headers: extra = {},
      admin = false,
      origin = ORIGIN,
    } = {},
  ) {
    const headers = {
      Origin: origin,
      "CF-Connecting-IP": "192.0.2.1",
      ...extra,
    };
    if (admin) headers["Cf-Access-Jwt-Assertion"] = token;
    let payload = body;
    if (body && !(body instanceof Uint8Array) && typeof body !== "string") {
      payload = JSON.stringify(body);
      headers["Content-Type"] = "application/json";
    }
    const request = new Request(ORIGIN + "/api/reviews" + path, {
      method,
      headers,
      body: payload,
    });
    const response = await handleReviews(request, env, fetcher);
    const data = response.headers
      .get("content-type")
      ?.includes("application/json")
      ? await response.json()
      : await response.arrayBuffer();
    return { status: response.status, data, response };
  }
  const adminSession = (await call("/admin/session", { admin: true })).data;
  const mutate = (id, body) =>
    call("/admin/" + id, {
      admin: true,
      method: "POST",
      headers: { "X-Review-CSRF": adminSession.csrf },
      body,
    });
  return {
    env,
    sql,
    db,
    objects,
    calls,
    call,
    jwt,
    token,
    adminSession,
    mutate,
    fetcher,
    failMail(value = true) {
      mailFails = value;
    },
    setTurnstile(value) {
      turnstileResult = value;
    },
  };
}
export const valid = (overrides = {}) => ({
  name: "Test Customer",
  email: "",
  review: "A useful and relevant review of completed work.",
  rating: 5,
  category: "furniture",
  photoCount: 0,
  photoConsent: false,
  consent: true,
  consentVersion: "reviews-2026-10-19-v1",
  requestId: crypto.randomUUID(),
  turnstileToken: "test-only-token",
  ...overrides,
});
export async function submit(f, body = valid()) {
  const start = await f.call("/submissions", { method: "POST", body });
  if (start.status !== 201 && start.status !== 200)
    throw Error(JSON.stringify(start));
  const { id, uploadToken } = start.data;
  const finish = () =>
    f.call("/submissions/" + id + "/complete", {
      method: "POST",
      headers: { "X-Review-Upload-Token": uploadToken },
    });
  return {
    id,
    uploadToken,
    body,
    finish,
    upload: (bytes, id = crypto.randomUUID(), mime = "image/png") =>
      f.call(`/submissions/${start.data.id}/photos/${id}`, {
        method: "PUT",
        headers: { "X-Review-Upload-Token": uploadToken, "Content-Type": mime },
        body: bytes,
      }),
  };
}
export const png = () =>
  sharp({
    create: { width: 80, height: 60, channels: 3, background: "#ccaa33" },
  })
    .png()
    .toBuffer();
export const moderation = (overrides = {}) => ({
  version: 0,
  status: "approved",
  notes: "Checked relevance, privacy and permission.",
  project: "",
  publicText: "",
  publicName: "",
  redactionReason: "",
  images: [],
  ...overrides,
});
