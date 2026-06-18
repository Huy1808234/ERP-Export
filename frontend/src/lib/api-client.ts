import queryString from 'query-string';

/**
 * Senior-level API utility with robust error handling and type safety.
 * Handles both JSON and File/Form data requests gracefully.
 */

type ApiErrorResponse = {
    statusCode: number;
    message: string;
    error: string;
    data?: null;
    details?: string;
};

const LOCAL_BACKEND_HOSTS = new Set(["127.0.0.1", "localhost"]);
const BACKEND_PROXY_PREFIX = "/api/backend";
const API_FORBIDDEN_EVENT = "mini-erp:api-forbidden";

let browserSessionRefreshPromise: Promise<void> | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
};

const toMessage = (value: unknown, fallback: string): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(String).join(", ");
    return fallback;
};

const getNetworkErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        const cause = (error as Error & { cause?: unknown }).cause;
        if (cause instanceof Error && cause.message) {
            return `${error.message}: ${cause.message}`;
        }

        return error.message;
    }

    return String(error);
};

const logNetworkWarning = (scope: string, url: string, error: unknown) => {
    if (process.env.NODE_ENV === "production") return;
    console.warn(`[API] ${scope} failed for ${url}: ${getNetworkErrorMessage(error)}`);
};

type ApiForbiddenEventDetail = {
    message: string;
    url?: string;
};

const emitForbiddenEvent = (message: string, url?: string): void => {
    if (typeof window === "undefined") return;

    window.dispatchEvent(new CustomEvent<ApiForbiddenEventDetail>(API_FORBIDDEN_EVENT, {
        detail: { message, url },
    }));
};

const emitForbiddenResponseEvent = async (res: Response, requestUrl?: string): Promise<void> => {
    if (res.status !== 403) return;

    let message = res.statusText || "Bạn không có quyền truy cập tài nguyên này";
    const contentType = res.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {
        try {
            const json = await res.clone().json() as unknown;
            const payload = isRecord(json) ? json : {};
            message = toMessage(payload.message, message);
        } catch (error) {
            logNetworkWarning("Forbidden response parse", requestUrl || "", error);
        }
    }

    emitForbiddenEvent(message, requestUrl);
};

const isEquivalentBackendOrigin = (requestUrl: URL, backendUrl: URL): boolean => {
    if (requestUrl.origin === backendUrl.origin) return true;

    return (
        requestUrl.protocol === backendUrl.protocol &&
        requestUrl.port === backendUrl.port &&
        LOCAL_BACKEND_HOSTS.has(requestUrl.hostname) &&
        LOCAL_BACKEND_HOSTS.has(backendUrl.hostname)
    );
};

const getBrowserBackendProxyUrl = (url: string): string => {
    if (typeof window === "undefined") return url;
    if (process.env.NEXT_PUBLIC_USE_BACKEND_PROXY === "false") return url;
    if (url === BACKEND_PROXY_PREFIX || url.startsWith(`${BACKEND_PROXY_PREFIX}/`)) return url;

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) return url;

    try {
        const parsedUrl = new URL(url);
        const parsedBackendUrl = new URL(backendUrl);

        if (!isEquivalentBackendOrigin(parsedUrl, parsedBackendUrl)) {
            return url;
        }

        const backendBasePath = parsedBackendUrl.pathname.replace(/\/+$/, "");
        const requestedPath = parsedUrl.pathname;
        const proxiedPath =
            backendBasePath && requestedPath.startsWith(`${backendBasePath}/`)
                ? requestedPath.slice(backendBasePath.length + 1)
                : requestedPath.replace(/^\/+/, "");

        return `/api/backend/${proxiedPath}${parsedUrl.search}`;
    } catch {
        return url;
    }
};

const isBackendProxyRequest = (url: string): boolean => {
    return url === BACKEND_PROXY_PREFIX || url.startsWith(`${BACKEND_PROXY_PREFIX}/`);
};

const refreshBrowserSession = async (): Promise<void> => {
    if (typeof window === "undefined") return;

    if (!browserSessionRefreshPromise) {
        browserSessionRefreshPromise = fetch("/api/auth/session", {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
        })
            .then(() => undefined)
            .catch((error: unknown) => {
                logNetworkWarning("Session refresh", "/api/auth/session", error);
            })
            .finally(() => {
                browserSessionRefreshPromise = null;
            });
    }

    await browserSessionRefreshPromise;
};

const fetchWithAuthRetry = async (url: string, options: RequestInit): Promise<Response> => {
    const res = await fetch(url, options);

    if (res.status !== 401 || !isBackendProxyRequest(url)) {
        return res;
    }

    await refreshBrowserSession();
    return fetch(url, options);
};

export const backendFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const requestUrl = getBrowserBackendProxyUrl(url);
    const res = await fetchWithAuthRetry(requestUrl, options);
    await emitForbiddenResponseEvent(res, requestUrl);
    return res;
};

const handleResponse = async <T>(res: Response, requestUrl?: string): Promise<T> => {
    const contentType = res.headers.get("content-type");
    let json: unknown = {};
    
    if (contentType && contentType.includes("application/json")) {
        try {
            json = await res.json();
        } catch (e) {
            console.error("[API] Error parsing JSON response:", e);
        }
    }

    if (res.ok) {
        return json as T;
    }

    // Standardized error object for the application
    const payload = isRecord(json) ? json : {};
    const message = toMessage(payload.message, res.statusText || "An unexpected error occurred");
    if (res.status === 403) {
        emitForbiddenEvent(message, requestUrl);
    }

    return {
        statusCode: res.status,
        message,
        error: toMessage(payload.error, "Unknown Error"),
        data: null
    } satisfies ApiErrorResponse as T;
};

const getFetchUrls = (url: string, method: string) => {
    if (method.toUpperCase() !== 'GET') return [url];

    try {
        const parsed = new URL(url);
        if (parsed.hostname === '127.0.0.1') {
            const fallback = new URL(url);
            fallback.hostname = 'localhost';
            return [url, fallback.toString()];
        }
        if (parsed.hostname === 'localhost') {
            const fallback = new URL(url);
            fallback.hostname = '127.0.0.1';
            return [url, fallback.toString()];
        }
    } catch {
        return [url];
    }

    return [url];
};

export const sendRequest = async <T>(props: IRequest): Promise<T> => {
    let { url } = props;
    const {
        method,
        body,
        queryParams = {},
        useCredentials = false,
        headers = {},
        nextOption = {}
    } = props;

    const options: RequestInit = {
        method,
        headers: new Headers({ 
            'content-type': 'application/json', 
            ...headers 
        }),
        body: body && typeof body === 'object' && !(body instanceof FormData) 
            ? JSON.stringify(body) 
            : (body as BodyInit),
        ...nextOption
    };

    if (useCredentials) options.credentials = "include";

    if (queryParams && Object.keys(queryParams).length > 0) {
        url = `${url}?${queryString.stringify(queryParams)}`;
    }

    const requestUrl = getBrowserBackendProxyUrl(url);
    let lastError: unknown = null;
    for (const fetchUrl of getFetchUrls(requestUrl, method)) {
        try {
            const res = await fetchWithAuthRetry(fetchUrl, options);
            return await handleResponse<T>(res, fetchUrl);
        } catch (error) {
            lastError = error;
            logNetworkWarning("Request", fetchUrl, error);
        }
    }

    return {
        statusCode: 500,
        message: "Network error or server unreachable",
        error: "FETCH_FAILED",
        data: null,
        details: getNetworkErrorMessage(lastError)
    } satisfies ApiErrorResponse as T;
};

export const sendRequestFile = async <T>(props: IRequest): Promise<T> => {
    let { url } = props;
    const {
        method,
        body,
        queryParams = {},
        useCredentials = false,
        headers = {},
        nextOption = {}
    } = props;

    const options: RequestInit = {
        method,
        headers: new Headers({ ...headers }),
        body: body as BodyInit,
        ...nextOption
    };

    if (useCredentials) options.credentials = "include";

    if (queryParams && Object.keys(queryParams).length > 0) {
        url = `${url}?${queryString.stringify(queryParams)}`;
    }

    const requestUrl = getBrowserBackendProxyUrl(url);

    try {
        const res = await fetchWithAuthRetry(requestUrl, options);
        return await handleResponse<T>(res, requestUrl);
    } catch (error) {
        logNetworkWarning("File request", requestUrl, error);
        return {
            statusCode: 500,
            message: "Network error or server unreachable",
            error: "FETCH_FILE_FAILED",
            data: null,
            details: getNetworkErrorMessage(error)
        } satisfies ApiErrorResponse as T;
    }
};
