const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface ApiRequestOptions extends RequestInit {
    headers?: Record<string, string>;
}

export async function apiRequest<T = any>(
    path: string,
    options: ApiRequestOptions = {}
): Promise<T> {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

    let res: Response;
    try {
        res = await fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...options.headers,
            },
        });
    } catch {
        throw new Error(
            `Unable to reach the API at ${API_URL}. Start the backend and check NEXT_PUBLIC_API_URL.`
        );
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
    }

    return data as T;
}