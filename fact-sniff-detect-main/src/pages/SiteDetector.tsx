import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
interface SiteResult { risk_score: number; badge: string; advice: { payment: string; actions: string[] }; reasons: {layer: string; message: string; status: string}[]; }
export default function SiteDetector() {
  const [url, setUrl] = useState(""); const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SiteResult | null>(null); const [error, setError] = useState("");
  async function scan(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    try { setResult(await apiRequest<SiteResult>("/ecommerce/analyze-advanced", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({url}) })); }
    catch (e) { setError(e instanceof Error ? e.message : "Analysis unavailable"); }
    finally { setBusy(false); }
  }
  return <DashboardLayout><div className="max-w-3xl space-y-6"><Card><CardHeader><CardTitle>E-commerce Risk Check</CardTitle></CardHeader><CardContent>
    <form onSubmit={scan} className="space-y-4"><label htmlFor="site-url">Website URL</label><Input id="site-url" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" required />
    <Button disabled={busy}>{busy ? "Checking…" : "Check website"}</Button></form>
    {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}
  </CardContent></Card>{result && <Card><CardHeader><CardTitle>{result.badge} — {result.risk_score.toFixed(1)}/100</CardTitle></CardHeader><CardContent>
    <p>{result.advice.payment}</p><p className="my-3 text-sm">Heuristic risk score, not a probability of fraud or a guarantee of safety.</p>
    <ul className="space-y-3">{result.reasons.map(r => <li key={r.layer}><strong>{r.layer.replace(/_/g, " ")} ({r.status})</strong><p>{r.message}</p></li>)}</ul>
  </CardContent></Card>}</div></DashboardLayout>;
}
