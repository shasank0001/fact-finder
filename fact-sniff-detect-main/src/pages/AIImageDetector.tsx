import React, { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Search, Camera, Bot, CheckCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { API_ENDPOINTS } from "@/lib/api";

interface ImageAnalysisResult {
  prediction: Record<string, number>;
  metadata?: Record<string, string> | null;
}

const AIImageDetector = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [results, setResults] = useState<ReturnType<typeof processApiResponse> | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error("Please select a valid image file");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }

      setImageFile(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processApiResponse = (data: ImageAnalysisResult) => {
    const predictions = data.prediction;

    let aiScore = 0;
    let humanScore = 0;

    if (predictions.ai !== undefined && predictions.human !== undefined) {
      aiScore = predictions.ai;
      humanScore = predictions.human;
    } else {
      throw new Error("Unsupported image model response");
    }

    const aiPercentage = Math.round(aiScore * 100);
    const humanPercentage = Math.round(humanScore * 100);

    let verdict = 'Inconclusive';
    if (aiPercentage > 70) {
      verdict = 'AI Generated';
    } else if (humanPercentage > 70) {
      verdict = 'Human Created';
    }

    // Simplified verdict label for UI (no percentages shown)
  const simpleVerdict = verdict === 'AI Generated' ? 'AI Generated' : verdict === 'Human Created' ? 'Likely human origin' : 'Inconclusive';

    const hasMetadata = data.metadata && Object.keys(data.metadata).length > 0;

    return {
  verdict,
  simpleVerdict,
      aiPercentage,
      humanPercentage,
      metadata: data.metadata,
      hasMetadata
    };
  };

  const handleScan = async () => {
    if (!imageFile) {
      toast.error("Please select an image file to analyze");
      return;
    }

    setIsScanning(true);
    setResults(null);
    toast.info("Analyzing image with AI model...");

    const formData = new FormData();
    formData.append("file", imageFile);

    try {
  const response = await fetch(API_ENDPOINTS.IMAGES.ANALYZE, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `Server error: ${response.status}`);
      }

      const data: ImageAnalysisResult = await response.json();
      const formattedResults = processApiResponse(data);
      setResults(formattedResults);

      if (formattedResults.aiPercentage > 70) {
        toast.error("🤖 The classifier favors AI origin.");
      } else {
        toast.success("✅ Analysis complete");
      }

    } catch (error) {
      console.error("Analysis Error:", error);
      toast.error(error instanceof Error ? error.message : "Analysis failed. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const getVerdictColor = (verdict: string) => {
    // Support both old and simplified labels
    switch (verdict) {
      case 'Human Created':
      case 'Likely human origin':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400';
      case 'AI Generated':
      case 'AI':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400';
    }
  };

  const resetAnalysis = () => {
    setImageFile(null);
    setImagePreview('');
    setResults(null);
  };

  const getVerdictTheme = (verdict: string) => {
    const v = verdict || "Inconclusive";
    if (v === 'AI Generated' || v === 'AI') {
      return {
        label: 'AI Generated',
        ring: 'ring-red-200/70 dark:ring-red-800/40',
        gradient: 'from-red-500 to-rose-600',
        icon: <Bot className="w-5 h-5" />,
        message: 'This image appears to be AI-generated.',
      };
    }
    if (v === 'Likely human origin' || v === 'Human Created') {
      return {
        label: 'Likely human origin',
        ring: 'ring-emerald-200/70 dark:ring-emerald-800/40',
        gradient: 'from-emerald-500 to-green-600',
        icon: <CheckCircle className="w-5 h-5" />,
        message: 'The classifier favors human origin. This does not verify the image or its context.',
      };
    }
    return {
      label: 'Inconclusive',
      ring: 'ring-amber-200/70 dark:ring-amber-800/40',
      gradient: 'from-amber-500 to-yellow-600',
      icon: <AlertTriangle className="w-5 h-5" />,
      message: 'We could not confidently determine the origin of this image.',
    };
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mx-auto">
            <Camera className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              📷 AI Image Detector
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Detect AI-generated vs human-created images
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Upload className="w-5 h-5" />
                Upload Image
              </CardTitle>
              <CardDescription>
                Upload an image to detect if it was generated by AI
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label className="text-slate-700 dark:text-slate-300 font-medium">
                  Select Image File
                </Label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-10 h-10 mb-4 text-slate-500" />
                      <p className="mb-2 text-sm text-slate-500 text-center">
                        <span className="font-semibold">Click to upload</span>
                      </p>
                      <p className="text-xs text-slate-500">PNG, JPG, JPEG up to 10MB</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept="image/*"
                    />
                  </label>
                </div>

                {imagePreview && (
                  <div className="mt-4">
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={resetAnalysis}
                      >
                        Remove
                      </Button>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      📁 {imageFile?.name}
                    </p>
                  </div>
                )}
              </div>

              <Button
                onClick={handleScan}
                disabled={isScanning || !imageFile}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-4 rounded-xl"
                size="lg"
              >
                {isScanning ? (
                  <>
                    <Search className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Analyze Image
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {isScanning && (
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-white/20">
                <CardContent className="py-12">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full mx-auto flex items-center justify-center animate-pulse">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Analyzing Image...
                    </h3>
                  </div>
                </CardContent>
              </Card>
            )}

            {results && (
              <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-white/20">
                <CardHeader>
                  <CardTitle className="text-slate-900 dark:text-white">
                    Detection Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Verdict Panel */}
                  {(() => {
                    const theme = getVerdictTheme(results.simpleVerdict ?? results.verdict);
                    return (
                      <div className={`p-8 rounded-2xl border border-white/20 ring-1 ${theme.ring} bg-white/80 dark:bg-slate-800/70 shadow-sm`}>
                        <div className="flex flex-col items-center text-center space-y-5">
                          <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${theme.gradient} shadow-lg ring-4 ring-white/60 dark:ring-white/10 flex items-center justify-center`}>
                            {React.cloneElement(theme.icon as React.ReactElement, { className: 'w-14 h-14 text-white' })}
                          </div>
                          <div className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                            {theme.label}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 max-w-md">
                            {theme.message}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Metadata */}
                  {results.hasMetadata && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <h4 className="font-semibold text-blue-800 dark:text-blue-400 mb-2">
                        Metadata Found
                      </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Image contains {Object.keys(results.metadata).length} metadata fields
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AIImageDetector;
