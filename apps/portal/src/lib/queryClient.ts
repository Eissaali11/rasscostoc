import { QueryClient, QueryFunction } from "@tanstack/react-query";

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem('refresh-token');
      if (!refreshToken) {
        throw new Error("No refresh token");
      }

      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        throw new Error("Refresh failed");
      }

      const data = await res.json();
      if (data.success && data.token && data.refreshToken) {
        localStorage.setItem('auth-token', data.token);
        localStorage.setItem('refresh-token', data.refreshToken);
        return data.token;
      }
      throw new Error("Invalid response schema");
    } catch (e) {
      localStorage.removeItem('auth-token');
      localStorage.removeItem('refresh-token');
      // Dispatch event to inform AuthProvider to clear state
      window.dispatchEvent(new CustomEvent('auth-session-expired'));
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    try {
      const text = await res.text();
      if (text) {
        try {
          const json = JSON.parse(text);
          errorMessage = json.message || json.error || text;
        } catch {
          errorMessage = text;
        }
      }
    } catch {
      // If we can't read the response, use status text
    }
    const error = new Error(errorMessage);
    (error as any).status = res.status;
    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  let token = localStorage.getItem('auth-token');
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  };
  
  try {
    let res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    if (res.status === 401 && !url.includes('/api/auth/refresh') && !url.includes('/api/auth/login')) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(url, {
          method,
          headers,
          body: data ? JSON.stringify(data) : undefined,
          credentials: "include",
        });
      }
    }

    await throwIfResNotOk(res);
    return res;
  } catch (error: any) {
    // If it's a network error (Failed to fetch), provide a more helpful message
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      throw new Error('فشل الاتصال بالسيرفر. يرجى التحقق من الاتصال بالإنترنت أو الاتصال بالدعم الفني.');
    }
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let token = localStorage.getItem('auth-token');
    const headers: Record<string, string> = {
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    };
    
    try {
      const path = queryKey.join("/") as string;
      let res = await fetch(path, {
        headers,
        credentials: "include",
      });

      if (res.status === 401 && !path.includes('/api/auth/refresh') && !path.includes('/api/auth/login')) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
          res = await fetch(path, {
            headers,
            credentials: "include",
          });
        }
      }

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);

      const responseText = await res.text();
      if (!responseText || !responseText.trim()) {
        return null;
      }

      const contentType = res.headers.get("content-type") || "";
      const trimmed = responseText.trim();
      const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[");

      if (!contentType.includes("application/json") && !looksLikeJson) {
        throw new Error("تم استلام HTML بدل JSON من السيرفر. تحقق من مسارات API أو إعادة تشغيل الخادم.");
      }

      return JSON.parse(responseText);
    } catch (error: any) {
      // If it's a network error (Failed to fetch), provide a more helpful message
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        throw new Error('فشل الاتصال بالسيرفر. يرجى التحقق من الاتصال بالإنترنت أو الاتصال بالدعم الفني.');
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // Cache for 5 minutes by default
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

