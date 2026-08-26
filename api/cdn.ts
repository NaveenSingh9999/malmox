export const config = { runtime: "edge" };

const REPO_RELEASE =
  "https://github.com/NaveenSingh9999/malmox-images/releases/download/images-v1";

export default async function handler(req: Request): Promise<Response> {
  const file = new URL(req.url).searchParams.get("f");
  if (!file || /[\\/]/.test(file) || file.includes("..")) {
    return new Response("bad request", { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${REPO_RELEASE}/${encodeURIComponent(file)}`, {
      redirect: "follow",
      cache: "no-store",
    });
  } catch {
    return new Response("upstream unreachable", { status: 502 });
  }
  if (!upstream.ok) {
    return new Response(`not found: ${file}`, { status: upstream.status });
  }

  const headers = new Headers();
  headers.set(
    "content-type",
    upstream.headers.get("content-type") ?? "application/octet-stream",
  );
  const len = upstream.headers.get("content-length");
  if (len) headers.set("content-length", len);
  headers.set("cache-control", "public, max-age=86400");
  return new Response(upstream.body, { status: 200, headers });
}
