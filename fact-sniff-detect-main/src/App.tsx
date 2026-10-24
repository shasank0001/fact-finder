import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import FakeNewsDetector from "./pages/FakeNewsDetector";

import FakeTweetDetector from "./pages/FakeTweetDetector";
import AIImageDetector from "./pages/AIImageDetector";
import AITextDetector from "./pages/AITextDetector";
import ResultHistory from "./pages/ResultHistory";
import Settings from "./pages/Settings";
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";
import SiteDetector from "./pages/SiteDetector";
import JobDetector from "./pages/JobDetector";
import APIDocs from "./pages/APIDocs";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/help" element={<Help />} />
                <Route path="/api-docs" element={<APIDocs />} />

                {/* Protected Routes */}
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/fake-news" element={
                  <ProtectedRoute>
                    <FakeNewsDetector />
                  </ProtectedRoute>
                } />

                <Route path="/fake-ecommerce" element={<ProtectedRoute><SiteDetector /></ProtectedRoute>} />
                <Route path="/scam-jobs" element={<ProtectedRoute><JobDetector /></ProtectedRoute>} />
                <Route path="/fake-tweets" element={
                  <ProtectedRoute>
                    <FakeTweetDetector />
                  </ProtectedRoute>
                } />
                <Route path="/ai-images" element={
                  <ProtectedRoute>
                    <AIImageDetector />
                  </ProtectedRoute>
                } />
                <Route path="/ai-text" element={
                  <ProtectedRoute>
                    <AITextDetector />
                  </ProtectedRoute>
                } />
                <Route path="/history" element={
                  <ProtectedRoute>
                    <ResultHistory />
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } />

                {/* 404 Route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
);

export default App;
