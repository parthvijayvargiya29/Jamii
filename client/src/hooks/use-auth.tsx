import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken, clearAuthToken } from "@/lib/queryClient";

interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "staff";
  restaurantId: string | null;
  shiftPin: string | null;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
  canAccessDashboard: boolean;
  canModifyInventory: boolean;
  canModifyRecipes: boolean;
  canDeleteLogs: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const { data, isLoading, error } = useQuery<{ user: User } | null>({
    queryKey: ["/api/auth/me"],
    enabled: !!getAuthToken(),
    retry: false,
  });

  useEffect(() => {
    if (data?.user) {
      setUser(data.user);
    } else if (error) {
      clearAuthToken();
      setUser(null);
    }
  }, [data, error]);

  const logout = () => {
    clearAuthToken();
    setUser(null);
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const isStaff = user?.role === "staff";
  const canAccessDashboard = isAdmin || isManager;
  const canModifyInventory = isAdmin || isManager;
  const canModifyRecipes = isAdmin || isManager;
  const canDeleteLogs = isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isLoading,
        isAuthenticated,
        isAdmin,
        isManager,
        isStaff,
        canAccessDashboard,
        canModifyInventory,
        canModifyRecipes,
        canDeleteLogs,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
