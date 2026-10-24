import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import MouseTrail from "@/components/MouseTrail";
import { Link, useNavigate } from "react-router-dom";
import { Shield, Search, Eye, AlertTriangle, FileText, Image, Video, MessageSquare, Zap, Users, TrendingUp, CheckCircle, Star, ArrowRight, Play, Award, Globe, Lock, User, ShoppingCart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const detectionServices = [
  {
    icon: FileText,
    title: "Fake News",
    description: "Detect misinformation and verify news authenticity",
    path: "/fake-news"
  },
  {
    icon: Search,
    title: "Scam Job Offers",
    description: "Spot fake job postings and employment scams",
    path: "/scam-jobs"
  },
  {
    icon: ShoppingCart,
    title: "E-commerce Detection",
    description: "Analyze websites for potential e-commerce fraud",
    path: "/fake-ecommerce"
  },
  {
    icon: Image,
    title: "AI-Generated Images",
    description: "Estimate whether an image has AI or human origin",
    path: "/ai-images"
  }
];

const Index = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 relative overflow-hidden">
      <AnimatedBackground />
      {/* <MouseTrail /> */}

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-primary rounded-xl shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent">
            FactState
          </span>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-lg px-3 py-2">
                <img
                  src={user?.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face`}
                  alt={user?.name}
                  className="w-6 h-6 rounded-full object-cover"
                />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {user?.name}
                </span>
              </div>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-white/20 hover:bg-white dark:hover:bg-slate-700"
              >
                Sign Out
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => navigate('/login')}
              className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-white/20 hover:bg-white dark:hover:bg-slate-700"
            >
              Sign In
            </Button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <div className="text-center space-y-8 mb-20">
          <div className="animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="gradient-text">
                🔍 Expose the Fake.
              </span>
              <br />
              <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
                Verify the Real.
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
              Advanced AI-powered platform to detect fake content, misinformation, and digital fraud across all major platforms and formats.
            </p>
          </div>

          <div className="animate-slide-up flex flex-col sm:flex-row gap-4 justify-center items-center">
            {isAuthenticated ? (
              <>
                <Button
                  size="lg"
                  onClick={() => navigate('/dashboard')}
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 animate-pulse-glow"
                >
                  Go to Dashboard
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/fake-news')}
                  className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-white/20 hover:bg-white dark:hover:bg-slate-700 px-8 py-4 text-lg font-semibold rounded-xl"
                >
                  Start Detection
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  onClick={() => navigate('/login')}
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 animate-pulse-glow"
                >
                  Start Free Check
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/help')}
                  className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-white/20 hover:bg-white dark:hover:bg-slate-700 px-8 py-4 text-lg font-semibold rounded-xl"
                >
                  Learn More
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Detection Services Grid */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              What Can You Check?
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              From social media posts to job offers, we help you verify almost anything you find online
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {detectionServices.map((service, index) => (
              <Card
                key={service.title}
                className="group hover:scale-105 transition-all duration-300 cursor-pointer bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-white/20 hover:shadow-2xl animate-scale-in hover-lift"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => {
                  if (isAuthenticated) {
                    navigate(service.path);
                  } else {
                    navigate('/login');
                  }
                }}
              >
                <CardContent className="p-6 text-center space-y-4">
                  <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary/20 to-indigo-500/20 rounded-2xl mx-auto group-hover:from-primary/30 group-hover:to-indigo-500/30 transition-all duration-300 animate-float">
                    <service.icon className="w-8 h-8 text-primary group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      {service.title}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {service.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Why Choose FactState?
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Our cutting-edge technology combines multiple AI models to provide the most accurate detection results
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-2xl mx-auto">
                <Zap className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Connected Checks</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Analysis time depends on the configured services and available evidence
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-2xl mx-auto">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Evidence and Limitations</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Inspect cited evidence and unavailable checks. Accuracy has not been independently benchmarked.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-2xl mx-auto">
                <Lock className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Privacy First</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Website scans and submitted feedback are stored. News checks send content to the configured external provider.
              </p>
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              How It Works
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Our three-step process makes detecting fake content simple and reliable
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-2xl mx-auto">
                <span className="text-2xl font-bold text-blue-500">1</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Upload Content</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Simply paste a URL, upload an image, or copy text content you want to verify
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-2xl mx-auto">
                <span className="text-2xl font-bold text-green-500">2</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">AI Analysis</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Our advanced AI models analyze multiple factors to detect patterns and inconsistencies
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-2xl mx-auto">
                <span className="text-2xl font-bold text-purple-500">3</span>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Get Results</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Receive analysis with explanations, evidence where available, and explicit uncertainty
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center space-y-8 bg-gradient-to-r from-primary/10 to-indigo-500/10 rounded-3xl p-12">
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white">
            Ready to Start Detecting?
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Use automated checks as a starting point for independent verification
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {isAuthenticated ? (
              <>
                <Button
                  size="lg"
                  onClick={() => navigate('/dashboard')}
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/fake-news')}
                  className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-white/20 hover:bg-white dark:hover:bg-slate-700 px-8 py-4 text-lg font-semibold rounded-xl"
                >
                  <Play className="mr-2 w-5 h-5" />
                  Start Detection
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="lg"
                  onClick={() => navigate('/login')}
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-4 text-lg font-semibold rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/help')}
                  className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-white/20 hover:bg-white dark:hover:bg-slate-700 px-8 py-4 text-lg font-semibold rounded-xl"
                >
                  <Play className="mr-2 w-5 h-5" />
                  Watch Demo
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="text-center space-y-8 animate-fade-in mt-20">
          <div className="flex items-center justify-center gap-8 flex-wrap">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Shield className="w-5 h-5 text-emerald-500" />
              <span className="font-medium">Evidence and Limitations</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Eye className="w-5 h-5 text-blue-500" />
              <span className="font-medium">10M+ Content Scanned</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Search className="w-5 h-5 text-amber-500" />
              <span className="font-medium">Automated Assistance</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/20 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white">FactState</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              © 2025 FactState. Powered by AI and Team Zero.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
