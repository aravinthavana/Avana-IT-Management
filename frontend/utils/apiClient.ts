// If VITE_API_URL is provided, use it. Otherwise, on production (e.g. Vercel), default to relative ''
// so requests use Vercel's same-origin rewrite proxy to Render, ensuring seamless cookie & CSRF handling.
const API_URL = (import.meta as any).env?.VITE_API_URL !== undefined
    ? (import.meta as any).env.VITE_API_URL
    : (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:8080');

export async function apiClient<T = any>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const defaultHeaders: Record<string, string> = {};

    if (!(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
    }

    const csrfMatch = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    if (csrfMatch) {
        defaultHeaders['x-xsrf-token'] = decodeURIComponent(csrfMatch[1]);
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...(options.headers as Record<string, string>),
        },
        credentials: options.credentials || 'include',
    });

    if (!response.ok) {
        let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
        try {
            const errorBody = await response.json();
            if (errorBody && errorBody.error) {
                errorMessage = errorBody.error;
            }
        } catch (_) {}
        throw new Error(errorMessage);
    }

    if (response.status === 204) {
        return {} as T;
    }

    return response.json();
}
