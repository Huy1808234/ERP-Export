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

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
};

const toMessage = (value: unknown, fallback: string): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map(String).join(", ");
    return fallback;
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

const handleResponse = async <T>(res: Response): Promise<T> => {
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
    return {
        statusCode: res.status,
        message: toMessage(payload.message, res.statusText || "An unexpected error occurred"),
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
            const res = await fetch(fetchUrl, options);
            return await handleResponse<T>(res);
        } catch (error) {
            lastError = error;
            console.error(`[API] Fetch failed for ${fetchUrl}:`, error);
        }
    }

    return {
        statusCode: 500,
        message: "Network error or server unreachable",
        error: "FETCH_FAILED",
        data: null,
        details: lastError instanceof Error ? lastError.message : String(lastError)
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
        const res = await fetch(requestUrl, options);
        return await handleResponse<T>(res);
    } catch (error) {
        console.error(`[API] Fetch File failed for ${requestUrl}:`, error);
        return {
            statusCode: 500,
            message: "Network error or server unreachable",
            error: "FETCH_FILE_FAILED"
        } satisfies ApiErrorResponse as T;
    }
};
