import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BackendProxyContext = {
  params: Promise<{
    path: string[];
  }>;
};

const BLOCKED_FORWARD_HEADERS = new Set([
  "authorization",
  "connection",
  "content-encoding",
  "content-length",
  "cookie",
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
    if (!BLOCKED_FORWARD_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
}

async function applySessionAuthHeader(headers: Headers): Promise<void> {
  const session = await auth();
  if (session?.error || !session?.accessToken) return;

  headers.set("authorization", `Bearer ${session.accessToken}`);
}

function getProxyErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause instanceof Error && cause.message) {
      return `${error.message}: ${cause.message}`;
    }

    return error.message;
  }

  return "Backend proxy failed";
}

async function proxyBackendRequest(
  request: NextRequest,
  context: BackendProxyContext,
): Promise<NextResponse> {
  try {
    const { path } = await context.params;
    const targetUrl = buildBackendUrl(path, request.nextUrl.search);
    const method = request.method.toUpperCase();
    const headers = cloneForwardHeaders(request);
    await applySessionAuthHeader(headers);

    const init: RequestInit = {
      method,
      headers,
      cache: "no-store",
    };

    if (method !== "GET" && method !== "HEAD") {
      init.body = await request.arrayBuffer();
    }

    const response = await fetch(targetUrl, init);
    const responseHeaders = new Headers(response.headers);
    const responseBody = method === "HEAD" ? null : await response.arrayBuffer();

    BLOCKED_FORWARD_HEADERS.forEach((header) => responseHeaders.delete(header));

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = getProxyErrorMessage(error);

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
