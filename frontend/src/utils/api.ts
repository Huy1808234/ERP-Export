import queryString from 'query-string';

/**
 * Senior-level API utility with robust error handling and type safety.
 * Handles both JSON and File/Form data requests gracefully.
 */

const handleResponse = async <T>(res: Response): Promise<T> => {
    const contentType = res.headers.get("content-type");
    let json: any = {};
    
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
    return {
        statusCode: res.status,
        message: json?.message || res.statusText || "An unexpected error occurred",
        error: json?.error || "Unknown Error",
        data: null
    } as any as T;
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

    try {
        const res = await fetch(url, options);
        return await handleResponse<T>(res);
    } catch (error) {
        console.error(`[API] Fetch failed for ${url}:`, error);
        return {
            statusCode: 500,
            message: "Network error or server unreachable",
            error: "FETCH_FAILED"
        } as any as T;
    }
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

    try {
        const res = await fetch(url, options);
        return await handleResponse<T>(res);
    } catch (error) {
        console.error(`[API] Fetch File failed for ${url}:`, error);
        return {
            statusCode: 500,
            message: "Network error or server unreachable",
            error: "FETCH_FILE_FAILED"
        } as any as T;
    }
};
