// Reviews are isolated from /api/quote and its D1 bindings.
export async function onRequest({ request, env }) {
  if (!env.REVIEWS_SERVICE)
    return Response.json(
      { error: "Website reviews are not configured yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  try {
    return await env.REVIEWS_SERVICE.fetch(request);
  } catch {
    return Response.json(
      { error: "Reviews are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
