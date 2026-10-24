import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
export function UnavailableDetector({ title }: { title: string }) {
  return <DashboardLayout><Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>
    <p>This detector is not available yet. No analysis or authenticity verdict is produced.</p>
    <p className="mt-3">For factual statements, use the news fact-checker and inspect its cited evidence.</p>
  </CardContent></Card></DashboardLayout>;
}
