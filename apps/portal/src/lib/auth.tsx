import { createContext, useContext, useEffect, ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import type { AuthResponse, LoginRequest, UserSafe } from '@shared/schema';

interface AuthContextType {
  user: UserSafe | null;
  login: (credentials: LoginRequest) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Identity is resolved from the httpOnly session cookie via /api/auth/me.
  // No token is read from JavaScript-accessible storage. A 401 (not logged in)
  // resolves to null rather than throwing.
  const { data: userResponse, isLoading } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: getQueryFn({ on401: 'returnNull' }),
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const user = (userResponse as any)?.user || null;

  // Login mutation — the server sets the httpOnly cookies on the response.
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const response = await apiRequest('POST', '/api/auth/login', credentials);
      return (await response.json()) as AuthResponse;
    },
    onSuccess: async (data) => {
      if (data.success) {
        // Load the user the freshly-set cookie authenticates.
        await queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      }
    },
  });

  // Logout mutation — the server clears the cookies.
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('POST', '/api/auth/logout');
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });

  // Clear cached identity when the API client signals the session has expired
  // (e.g. refresh failed).
  useEffect(() => {
    const handleSessionExpired = () => {
      queryClient.setQueryData(['/api/auth/me'], null);
      queryClient.clear();
    };

    window.addEventListener('auth-session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth-session-expired', handleSessionExpired);
    };
  }, [queryClient]);

  const login = async (credentials: LoginRequest) => {
    return loginMutation.mutateAsync(credentials);
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading: isLoading || loginMutation.isPending,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
