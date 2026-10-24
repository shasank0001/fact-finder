import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import {
  Shield,
  Home,
  FileText,
  AlertTriangle,
  Search,
  MessageSquare,
  Image,
  Video,
  History,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
  BookOpen
} from "lucide-react";
import { ShoppingCart } from "lucide-react";

const sidebarItems = [
  { icon: Home, label: "Dashboard", path: "/dashboard" },
  { icon: FileText, label: "Fake News", path: "/fake-news" },
  { icon: ShoppingCart, label: "Website Risk", path: "/fake-ecommerce" },
  { icon: Search, label: "Job Risk", path: "/scam-jobs" },
  { icon: Image, label: "AI Images", path: "/ai-images" },
  { icon: History, label: "History", path: "/history" },
  { icon: Settings, label: "Settings", path: "/settings" },
  { icon: HelpCircle, label: "Help", path: "/help" },
  { icon: BookOpen, label: "API Docs", path: "/api-docs" },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try { await logout(); navigate("/"); } catch { /* Preserve session state when logout fails. */ }
  };

  const isActivePath = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
      {/* Mobile menu overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-0 h-full w-64 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-r border-white/20 z-50 transition-transform duration-300 lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 p-6 border-b border-white/20">
            <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-xl shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
              DigiSahayak
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {sidebarItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200
                  ${isActivePath(item.path)
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={user?.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face`}
                alt={user?.name}
                className="w-10 h-10 rounded-full object-cover border-2 border-white/50"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="w-full bg-white/50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border-b border-white/20">
          <div className="flex items-center justify-between px-6 py-4">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-4 ml-auto">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
