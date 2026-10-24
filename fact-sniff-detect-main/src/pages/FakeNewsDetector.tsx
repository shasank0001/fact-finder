import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Link2, Search, AlertTriangle, CheckCircle, XCircle, Globe, Calendar, User, Eye, Shield, Clock } from "lucide-react";
import { toast } from "sonner";
import { API_ENDPOINTS } from "@/lib/api";

interface NewsVerificationResult {
  verdict: "True" | "False" | "Uncertain" | "Error";
  explanation: string;
  parsed_output: {
    verdict_overall: "True" | "False" | "Uncertain";
    claims: Array<{
      claim_text: string;
      evaluation: "Supported" | "Refuted" | "Unverified";
      evidence: Array<{
        source_title: string;
        url: string;
        publication_date: string;
        snippet: string;
      }>;
      notes: string;
    }>;
    sources_used: Array<{
      source_title: string;
      url: string;
      publication_date: string;
    }>;
    explanation: string;
  };
  grounding_metadata: {
    search_queries: string[];
    sources: Array<{
      source_title: string;
      url: string;
      publication_date: string;
    }>;
    claims_analysis: unknown[];
  };
}

const FakeNewsDetector = () => {
  const [inputType, setInputType] = useState<'url' | 'text'>('text');
  const [inputValue, setInputValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<NewsVerificationResult | null>(null);

  const handleScan = async () => {
    if (!inputValue.trim()) {
      toast.error("Please enter a news statement or claim to analyze");
      return;
    }

    setResults(null);
    setIsScanning(true);
    toast.info("Starting fact-checking analysis...");

    try {
  const response = await fetch(API_ENDPOINTS.NEWS.ANALYZE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: inputValue })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Backend response:", data); // Debug log

      // The backend returns { result: { verdict, explanation, parsed_output, grounding_metadata } }
      const result = data.result;

      if (!result) {
        throw new Error("No result returned from backend");
      }

      setResults(result);

      // Show appropriate toast based on result
      if (result.verdict === "False") {
        toast.error("⚠️ Likely false information detected!");
      } else if (result.verdict === "Uncertain") {
        toast.warning("⚠️ Could not verify - insufficient evidence");
      } else if (result.verdict === "True") {
        toast.success("✅ Information appears to be accurate");
      } else if (result.verdict === "Error") {
        toast.error("❌ Error during analysis");
      } else {
        toast.info("Analysis complete - check results for details");
      }

    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to verify news. Please try again.");
      setResults({
        verdict: "Error",
        explanation: `Analysis failed: ${error.message}`,
        parsed_output: { verdict_overall: "Uncertain", claims: [], sources_used: [], explanation: "" },
        grounding_metadata: { search_queries: [], sources: [], claims_analysis: [] }
      });
    } finally {
      setIsScanning(false);
    }
  };

  const getResultColor = (verdict: string) => {
    switch (verdict) {
      case 'True':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400';
      case 'False':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'Uncertain':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
      case 'Error':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-400';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900/20 dark:text-slate-400';
    }
  };

  const getResultIcon = (verdict: string) => {
    switch (verdict) {
      case 'True':
        return <CheckCircle className="w-5 h-5 text-emerald-600" />;
      case 'False':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'Uncertain':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'Error':
        return <Shield className="w-5 h-5 text-slate-600" />;
      default:
        return <Shield className="w-5 h-5 text-slate-600" />;
    }
  };

  const getVerdictDisplayText = (verdict: string) => {
    switch (verdict) {
      case 'True':
        return 'Likely True';
      case 'False':
        return 'Likely False';
      case 'Uncertain':
        return 'Uncertain/Unverifiable';
      case 'Error':
        return 'Analysis Error';
      default:
        return verdict;
    }
  };


  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl mx-auto">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              📰 Fake News Detector
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              AI-powered fact-checking and misinformation detection using advanced analysis
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-white/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <FileText className="w-5 h-5" />
                  Content to Fact-Check
                </CardTitle>
                <CardDescription>
                  Enter a news claim, statement, or article content to verify its accuracy
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Input Type Toggle */}
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                  <Button
                    variant={inputType === 'text' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setInputType('text')}
                    className="flex-1"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Statement/Claim
                  </Button>
                  <Button
                    variant={inputType === 'url' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setInputType('url')}
                    className="flex-1"
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    Article URL
                  </Button>
                </div>

                {/* Input Field */}
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300 font-medium">
                    {inputType === 'url' ? 'News Article URL' : 'News Statement or Claim'}
                  </Label>
                  {inputType === 'url' ? (
                    <Input
                      placeholder="https://example.com/news-article"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="bg-white/50 dark:bg-slate-700/50"
                    />
                  ) : (
                    <Textarea
                      placeholder="Enter the news statement, claim, or article content you want to fact-check..."
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      className="bg-white/50 dark:bg-slate-700/50 min-h-[120px]"
                    />
                  )}
                </div>

                <Button
                  onClick={handleScan}
                  disabled={isScanning}
                  className="w-full bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
                  size="lg"
                >
                  {isScanning ? (
                    <>
                      <Search className="w-5 h-5 mr-2 animate-spin" />
                      Fact-Checking...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      Start Fact-Check
                    </>
                  )}
                </Button>

                {/* Example prompts */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-400 mb-2">Example Statements to Test:</h4>
                  <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                    <div>• "The COVID-19 vaccine contains microchips"</div>
                    <div>• "Climate change is caused by solar cycles"</div>
                    <div>• "5G networks cause health problems"</div>
                    <div>• "The 2020 US election was rigged"</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {/* Loading Animation */}
            {isScanning && (
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-white/20">
                <CardContent className="py-12">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-orange-600 rounded-full mx-auto flex items-center justify-center animate-pulse">
                      <FileText className="w-8 h-8 text-white" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Fact-Checking in Progress...
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400">
                        Searching sources, verifying claims, and analyzing credibility
                      </p>
                    </div>
                    <div className="flex justify-center space-x-1">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-2 h-2 bg-red-500 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.1}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results */}
            {results && (
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-slate-900 dark:text-white">
                    {getResultIcon(results.verdict)}
                    Fact-Check Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Verification Result Badge */}
                  <div className="flex items-center justify-between">
                    <Badge className={`px-4 py-2 text-sm font-semibold ${getResultColor(results.verdict)}`}>
                      {getVerdictDisplayText(results.verdict)}
                    </Badge>

                  </div>

                  {/* Status */}
                  <div className={`p-4 rounded-lg border-2 ${
                    results.verdict === "False"
                      ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                      : results.verdict === "True"
                      ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'
                      : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                  }`}>
                    <div className="flex items-center gap-2 font-semibold">
                      {getResultIcon(results.verdict)}
                      <span className={
                        results.verdict === "False"
                          ? 'text-red-800 dark:text-red-400'
                          : results.verdict === "True"
                          ? 'text-emerald-800 dark:text-emerald-400'
                          : 'text-amber-800 dark:text-amber-400'
                      }>
                        Verdict: {getVerdictDisplayText(results.verdict)}
                      </span>
                    </div>
                  </div>

                  {/* Reasoning */}
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Analysis Details
                    </h4>
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {results.explanation}
                      </p>
                    </div>
                  </div>

                  {/* Claims Analysis */}
                  {results.parsed_output?.claims && results.parsed_output.claims.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <Search className="w-4 h-4" />
                        Claims Analysis ({results.parsed_output.claims.length} claims)
                      </h4>
                      <div className="space-y-3">
                        {results.parsed_output.claims.slice(0, 3).map((claim, index) => (
                          <div key={index} className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2">
                                {claim.claim_text}
                              </p>
                              <Badge
                                variant="outline"
                                className={`text-xs flex-shrink-0 ${
                                  claim.evaluation === 'Supported' ? 'text-emerald-700 border-emerald-300' :
                                  claim.evaluation === 'Refuted' ? 'text-red-700 border-red-300' :
                                  'text-amber-700 border-amber-300'
                                }`}
                              >
                                {claim.evaluation}
                              </Badge>
                            </div>
                            {claim.notes && (
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                {claim.notes}
                              </p>
                            )}
                          </div>
                        ))}
                        {results.parsed_output.claims.length > 3 && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                            ... and {results.parsed_output.claims.length - 3} more claims
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sources */}
                  {results.parsed_output?.sources_used && results.parsed_output.sources_used.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <Link2 className="w-4 h-4" />
                        Sources Consulted ({results.parsed_output.sources_used.length})
                      </h4>
                      <div className="space-y-2">
                        {results.parsed_output.sources_used.slice(0, 3).map((source, index) => (
                          <div key={index} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-start gap-2">
                              <Link2 className="w-3 h-3 text-blue-500 mt-1 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-blue-800 dark:text-blue-300 line-clamp-1">
                                  {source.source_title}
                                </p>
                                {source.url && (
                                  <a
                                    href={source.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline line-clamp-1"
                                  >
                                    {source.url}
                                  </a>
                                )}
                                {source.publication_date && (
                                  <p className="text-xs text-blue-600 dark:text-blue-400">
                                    {source.publication_date}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {results.parsed_output.sources_used.length > 3 && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                            ... and {results.parsed_output.sources_used.length - 3} more sources
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recommendations based on result */}
                  <div>
                    <h4 className="font-semibold text-blue-800 dark:text-blue-400 mb-3 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Recommendations
                    </h4>
                    <div className="space-y-2">
                      {results.verdict === "False" && (
                        <>
                          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                            <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-red-800 dark:text-red-300">
                              Do not share this information as it appears to contain false claims
                            </span>
                          </div>
                          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-blue-800 dark:text-blue-300">
                              Verify information with multiple reliable sources before believing or sharing
                            </span>
                          </div>
                        </>
                      )}

                      {results.verdict === "Uncertain" && (
                        <>
                          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-amber-800 dark:text-amber-300">
                              Could not verify this claim with sufficient evidence
                            </span>
                          </div>
                          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-blue-800 dark:text-blue-300">
                              Cross-reference with authoritative sources for verification
                            </span>
                          </div>
                        </>
                      )}

                      {results.verdict === "True" && (
                        <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-emerald-800 dark:text-emerald-300">
                            This information appears to be accurate based on available evidence
                          </span>
                        </div>
                      )}

                      {results.verdict === "Error" && (
                        <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-900/20 rounded-lg border border-slate-200 dark:border-slate-800">
                          <XCircle className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-slate-800 dark:text-slate-300">
                            An error occurred during analysis. Please try again.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Analysis Metadata */}
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      <span>Analyzed at: {new Date().toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-3 h-3" />
                      <span>Powered by AI fact-checking with Google Search grounding</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FakeNewsDetector;
