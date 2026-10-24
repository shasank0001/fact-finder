import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
interface JobResult { risk_level: string; is_suspicious: boolean; final_prediction_reason: string; red_flags: string[]; }
export default function JobDetector() {
  const [form, setForm] = useState({name:"", website:"", email:"", phone:"", address:"", job_description:""});
  const [result, setResult] = useState<JobResult | null>(null); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function scan(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    try { const data = await apiRequest<{result: JobResult}>("/job/analyze", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form)}); setResult(data.result); }
    catch(e) { setError(e instanceof Error ? e.message : "Analysis unavailable"); } finally { setBusy(false); }
  }
  return <DashboardLayout><Card className="max-w-3xl"><CardHeader><CardTitle>Job Offer Risk Check</CardTitle></CardHeader><CardContent>
    <p className="mb-4">Checks warning signs in the details you supply. Employer identity is not independently verified.</p>
    <form onSubmit={scan} className="space-y-4">{(["name","website","email","phone","address"] as const).map(key => <div key={key}><label htmlFor={`job-${key}`} className="capitalize">{key}</label><Input id={`job-${key}`} required={key === "name"} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></div>)}
    <label htmlFor="job-description">Job description</label><Textarea id="job-description" required value={form.job_description} onChange={e=>setForm({...form,job_description:e.target.value})}/><Button disabled={busy}>{busy ? "Checking…" : "Check offer"}</Button></form>
    {error && <p role="alert" className="mt-4 text-red-600">{error}</p>}{result && <div className="mt-6"><h2 className="text-xl font-semibold">{result.risk_level} risk</h2><p>{result.final_prediction_reason}</p><ul>{result.red_flags.map(flag=><li key={flag}>{flag}</li>)}</ul></div>}
  </CardContent></Card></DashboardLayout>;
}
