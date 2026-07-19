import { QueryClient, QueryFunction } from "@tanstack/react-query";

function getClientError(key: 'server_connection_failed' | 'html_instead_of_json'): string {
  const lang = (typeof localStorage !== 'undefined' && localStorage.getItem('language') === 'en') ? 'en' : 'ar';
  const messages = {
    server_connection_failed: {
      ar: 'فشل الاتصال بالسيرفر. يرجى التحقق من الاتصال بالإنترنت أو الاتصال بالدعم الفني.',
      en: 'Failed to connect to the server. Please check your internet connection or contact support.',
    },
    html_instead_of_json: {
      ar: 'تم استلام HTML بدل JSON من السيرفر. تحقق من مسارات API أو إعادة تشغيل الخادم.',
      en: 'Received HTML instead of JSON from the server. Check API routes or restart the server.',
    },
  } as const;
  return messages[key][lang];
}

let refreshPromise: Promise<boolean> | null = null;

// Rotate the session using the httpOnly refresh cookie. The server reads the
// refresh token from the cookie and sets fresh cookies on the response, so no
// token is read from or written to JavaScript-accessible storage. Returns
// whether the session was successfully refreshed.
async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error("Refresh failed");
      }

      const data = await res.json();
      if (data.success) {
        return true;
      }
      throw new Error("Invalid response schema");
    } catch (e) {
      // Inform AuthProvider to clear cached identity.
      window.dispatchEvent(new CustomEvent('auth-session-expired'));
      return false;
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
  // Auth travels in the httpOnly cookie (credentials: "include"); no Bearer
  // header is set from JavaScript-accessible storage.
  const headers: Record<string, string> = {
    "X-Requested-With": "XMLHttpRequest",
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  try {
    let res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    if (res.status === 401 && !url.includes('/api/auth/refresh') && !url.includes('/api/auth/login')) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
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
      throw new Error(getClientError('server_connection_failed'));
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
    const headers: Record<string, string> = {
      "X-Requested-With": "XMLHttpRequest",
    };

    try {
      const path = queryKey.join("/") as string;
      let res = await fetch(path, {
        headers,
        credentials: "include",
      });

      if (res.status === 401 && !path.includes('/api/auth/refresh') && !path.includes('/api/auth/login')) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
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
        throw new Error(getClientError("html_instead_of_json"));
      }

      return JSON.parse(responseText);
    } catch (error: any) {
      // If it's a network error (Failed to fetch), provide a more helpful message
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        throw new Error(getClientError('server_connection_failed'));
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

