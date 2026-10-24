import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
interface History { timeline: { scanned_at: string; badge: string; risk_score: number }[]; }
export default function ResultHistory() {
  const [url,setUrl]=useState(""); const [data,setData]=useState<History | null>(null); const [error,setError]=useState("");
  async function load(e: React.FormEvent) { e.preventDefault(); setError(""); setData(null); try {setData(await apiRequest<History>(`/api/site-history?url=${encodeURIComponent(new URL(url).href)}`));} catch(e) {setError(e instanceof Error ? e.message : "History unavailable");} }
  return <DashboardLayout><Card><CardHeader><CardTitle>Website Scan History</CardTitle></CardHeader><CardContent>
    <p className="mb-4">View saved website checks. News, image and job history are not stored.</p><form onSubmit={load} className="space-y-3"><label htmlFor="history-url">Website URL</label><Input id="history-url" type="url" value={url} onChange={e=>setUrl(e.target.value)} required/><Button>Load history</Button></form>
    {error && <p role="alert">{error}</p>}<ul className="mt-4 space-y-3">{data?.timeline.map((r,i)=><li key={i}>{new Date(r.scanned_at).toLocaleString()} — {r.badge}, {r.risk_score.toFixed(1)}/100</li>)}</ul>
  </CardContent></Card></DashboardLayout>;
}
