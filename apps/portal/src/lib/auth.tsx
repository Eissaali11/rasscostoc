import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
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
  const [token, setToken] = useState<string | null>(() => 
    localStorage.getItem('auth-token')
  );
  const queryClient = useQueryClient();

  // Get current user data
  const { data: userResponse, isLoading, error } = useQuery({
    queryKey: ['/api/auth/me'],
    enabled: !!token,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const user = (userResponse as any)?.user || null;

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const response = await apiRequest('POST', '/api/auth/login', credentials);
      return await response.json() as AuthResponse;
    },
    onSuccess: (data) => {
      if (data.success && data.token && data.refreshToken) {
        setToken(data.token);
        localStorage.setItem('auth-token', data.token);
        localStorage.setItem('refresh-token', data.refreshToken);
      }
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const refreshToken = localStorage.getItem('refresh-token');
      await apiRequest('POST', '/api/auth/logout', { refreshToken });
    },
    onSuccess: () => {
      setToken(null);
      localStorage.removeItem('auth-token');
      localStorage.removeItem('refresh-token');
      queryClient.clear();
    },
  });

  // Invalidate queries when token changes
  useEffect(() => {
    if (token) {
      // When token is set, refetch user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    } else {
      // When token is cleared, clear all cached data
      queryClient.clear();
    }
  }, [token, queryClient]);

  // Clear token if user fetch fails
  useEffect(() => {
    if (error && token) {
      setToken(null);
      localStorage.removeItem('auth-token');
      localStorage.removeItem('refresh-token');
    }
  }, [error, token]);

  // Listen for session expiry event from API client
  useEffect(() => {
    const handleSessionExpired = () => {
      setToken(null);
      localStorage.removeItem('auth-token');
      localStorage.removeItem('refresh-token');
      queryClient.clear();
    };

    window.addEventListener('auth-session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth-session-expired', handleSessionExpired);
    };
  }, [queryClient]);

  const login = async (credentials: LoginRequest) => {
    const result = await loginMutation.mutateAsync(credentials);
    return result;
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const value: AuthContextType = {
    user,
    login,
    logout,
    isLoading: isLoading || loginMutation.isPending,
    isAuthenticated: !!user && !!token,
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

// Helper to get auth headers for API requests
export function getAuthHeaders() {
  const token = localStorage.getItem('auth-token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}