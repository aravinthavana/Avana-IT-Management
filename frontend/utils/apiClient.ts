const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8080';

export async function apiClient<T = any>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const defaultHeaders: Record<string, string> = {};

    if (!(options.body instanceof FormData)) {
        defaultHeaders['Content-Type'] = 'application/json';
    }

    const csrfMatch = document.cookie.match(/csrfToken=([^;]+)/);
    if (csrfMatch) {
        defaultHeaders['X-CSRF-Token'] = csrfMatch[1];
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
