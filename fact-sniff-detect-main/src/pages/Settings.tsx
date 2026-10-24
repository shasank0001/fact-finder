import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
export default function Settings() {
  const {user}=useAuth();
  return <DashboardLayout><Card><CardHeader><CardTitle>Settings</CardTitle></CardHeader><CardContent className="space-y-5">
    <p>Signed in as {user?.email}. Account credentials are managed by the administrator.</p>
    <div className="flex items-center justify-between"><span>Appearance</span><ThemeToggle /></div>
  </CardContent></Card></DashboardLayout>;
}
