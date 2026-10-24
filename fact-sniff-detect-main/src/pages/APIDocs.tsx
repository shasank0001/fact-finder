import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Row = ({ method, path, body, notes }: { method: string; path: string; body?: string[]; notes?: string[] }) => (
  <div className="rounded-xl border border-white/20 bg-white/70 dark:bg-slate-800/70 p-4 space-y-2">
    <div className="flex items-center gap-3">
      <Badge variant="secondary" className="uppercase tracking-wide">{method}</Badge>
      <code className="text-sm font-mono bg-black/5 dark:bg-white/5 px-2 py-1 rounded">{path}</code>
    </div>
    {body && body.length > 0 && (
      <div className="mt-2">
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Body (JSON):</div>
        <ul className="text-sm text-slate-700 dark:text-slate-300 list-disc pl-5 space-y-1">
          {body.map((b, i) => (<li key={i}>{b}</li>))}
        </ul>
      </div>
    )}
    {notes && notes.length > 0 && (
      <div className="mt-2">
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Notes:</div>
        <ul className="text-sm text-slate-700 dark:text-slate-300 list-disc pl-5 space-y-1">
          {notes.map((n, i) => (<li key={i}>{n}</li>))}
        </ul>
      </div>
    )}
  </div>
);

const APIDocs = () => {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">APIs as a Service</h1>
          <p className="text-slate-600 dark:text-slate-400">All analysis routes require a signed login cookie or a server-issued Bearer token.</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Base URL: <code>http://localhost:8000</code></p>
        </div>

        <Card className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-white">Endpoints</CardTitle>
            <CardDescription>Request inputs for each API route</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Row
              method="POST"
              path="/news/verify"
              body={[
                "query: string (required) — news text, claim, or URL",
              ]}
            />



            <Row
              method="POST"
              path="/ecommerce/analyze-advanced"
              body={[
                "url: string (required, valid URL)",
              ]}
              notes={["Risk signals and unavailable checks; returns badge and advice"]}
            />

            <Row
              method="POST"
              path="/ecommerce/feedback"
              body={[
                "url: string (required, valid URL)",
                "delivered: boolean (required)",
                "order_hash: string (optional) — proof hash or reference ID",
              ]}
            />

            <Row
              method="GET"
              path="/ecommerce/compare?url=..."
              notes={["Basic and advanced share one maintained scoring pipeline"]}
            />

            <Row
              method="POST"
              path="/image/analyze"
              body={[
                "multipart/form-data: file (required) — image binary",
              ]}
              notes={["Requires optional image dependencies and local model weights; returns 503 when unavailable"]}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default APIDocs;
