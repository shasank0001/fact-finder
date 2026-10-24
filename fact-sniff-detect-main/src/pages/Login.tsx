import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setIsLoading(true);
      await login(email, password);
      toast.success("Welcome! Redirecting to dashboard...");
      setTimeout(() => navigate("/dashboard"), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 relative overflow-hidden flex items-center justify-center p-4">
      <AnimatedBackground />

      {/* Header */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-10">
        <Link to="/" className="flex items-center gap-3 group">
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors" />
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
              FactState
            </span>
          </div>
        </Link>
        <ThemeToggle />
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-white/20 shadow-2xl animate-scale-in">
        <CardHeader className="text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary to-indigo-600 rounded-2xl mx-auto animate-pulse-glow">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
              Welcome to FactState
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Sign in with your email and password to get started
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </div>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="text-center space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sign in to use the configured verification services.
            </p>

            <div className="text-xs text-slate-500 dark:text-slate-500">
              Use the analyst credentials configured by your administrator.
            </div>
          </div>

          <div className="text-center space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              By signing in, you agree to our{" "}
              <Button variant="link" className="p-0 h-auto text-primary font-semibold">
                Terms of Service
              </Button>{" "}
              and{" "}
              <Button variant="link" className="p-0 h-auto text-primary font-semibold">
                Privacy Policy
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
