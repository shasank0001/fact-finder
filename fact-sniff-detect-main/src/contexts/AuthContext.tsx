import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest } from "@/lib/api";
interface User { id: string; name: string; email: string; avatar?: string; }
interface AuthContextType {
  user: User | null; isAuthenticated: boolean; isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    localStorage.removeItem("factState_user");
    apiRequest<User>("/auth/me").then(setUser).catch(() => setUser(null)).finally(() => setIsLoading(false));
  }, []);
  const login = async (email: string, password: string) => {
    const authenticated = await apiRequest<User>("/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
    });
    setUser(authenticated);
  };
  const logout = async () => {
    await apiRequest("/auth/logout", { method: "POST" });
    setUser(null);
  };
  return <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isLoading }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
