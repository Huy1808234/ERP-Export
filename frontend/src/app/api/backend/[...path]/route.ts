import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BackendProxyContext = {
  params: Promise<{
    path: string[];
  }>;
};

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function buildBackendUrl(pathSegments: string[], search: string): string {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/+$/, "");

  if (!backendUrl) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL is not configured");
  }

  const path = pathSegments.map((segment) => encodeURIComponent(segment)).join("/");
  return `${backendUrl}/${path}${search}`;
}

function cloneForwardHeaders(request: NextRequest): Headers {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
}

async function proxyBackendRequest(
  request: NextRequest,
  context: BackendProxyContext,
): Promise<NextResponse> {
  try {
    const { path } = await context.params;
    const targetUrl = buildBackendUrl(path, request.nextUrl.search);
    const method = request.method.toUpperCase();
    const init: RequestInit = {
      method,
      headers: cloneForwardHeaders(request),
      cache: "no-store",
    };

    if (method !== "GET" && method !== "HEAD") {
      init.body = await request.arrayBuffer();
    }

    const response = await fetch(targetUrl, init);
    const responseHeaders = new Headers(response.headers);

    HOP_BY_HOP_HEADERS.forEach((header) => responseHeaders.delete(header));

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backend proxy failed";

    return NextResponse.json(
      {
        statusCode: 502,
        message,
        error: "BACKEND_PROXY_FAILED",
        data: null,
      },
      { status: 502 },
    );
  }
}

export const GET = proxyBackendRequest;
export const POST = proxyBackendRequest;
export const PUT = proxyBackendRequest;
export const PATCH = proxyBackendRequest;
export const DELETE = proxyBackendRequest;
