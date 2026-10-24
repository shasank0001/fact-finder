import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
const services = [
  {title:"News Fact Check", description:"Review claims and cited search evidence", path:"/fake-news"},
  {title:"E-commerce Risk Check", description:"Inspect website risk signals and unavailable checks", path:"/fake-ecommerce"},
  {title:"Job Offer Risk Check", description:"Check supplied details for scam warning signs", path:"/scam-jobs"},
  {title:"AI Image Origin", description:"Estimate AI or human origin using an optional local model", path:"/ai-images"},
];
export default function Dashboard() {
  const navigate = useNavigate(); const {user} = useAuth();
  return <DashboardLayout><div className="space-y-6"><h1 className="text-3xl font-bold">Welcome, {user?.name}</h1>
    <p>Review the evidence and limitations behind each result. These checks do not guarantee authenticity or safety.</p>
    <div className="grid gap-5 md:grid-cols-2">{services.map(s=><Card key={s.path}><CardHeader><CardTitle>{s.title}</CardTitle></CardHeader><CardContent><p className="mb-4">{s.description}</p><Button onClick={()=>navigate(s.path)}>Open {s.title}</Button></CardContent></Card>)}</div>
    <Button variant="outline" onClick={()=>navigate("/history")}>View saved website history</Button>
  </div></DashboardLayout>;
}
