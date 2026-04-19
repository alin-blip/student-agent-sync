import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { APP_ROLES } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PlusCircle, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function CompanyBranchDetailPage() {
  const { branchId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [allowedDomains, setAllowedDomains] = useState<string>("");
  const [headerColor, setHeaderColor] = useState<string>("");
  const [buttonColor, setButtonColor] = useState<string>("");
  const [textColor, setTextColor] = useState<string>("");

  const { data: branch, isLoading: isLoadingBranch, error: branchError } = useQuery({
    queryKey: ["branch", branchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*, profiles(full_name)").eq("id", branchId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  const { data: consultants, isLoading: isLoadingConsultants, error: consultantsError } = useQuery({
    queryKey: ["branchConsultants", branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("branch_id", branchId);
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  const { data: widgetSettings, isLoading: isLoadingWidgetSettings, error: widgetSettingsError } = useQuery({
    queryKey: ["widgetSettings", branchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("widget_settings").select("*").eq("branch_id", branchId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  useEffect(() => {
    if (widgetSettings) {
      setAllowedDomains(widgetSettings.allowed_domains ? widgetSettings.allowed_domains.join(", ") : "");
      setHeaderColor(widgetSettings.header_color || "");
      setButtonColor(widgetSettings.button_color || "");
      setTextColor(widgetSettings.text_color || "");
    }
  }, [widgetSettings]);

  const updateWidgetSettings = useMutation({
    mutationFn: async () => {
      if (!branchId) throw new Error("Branch ID is missing.");
      const domainsArray = allowedDomains.split(",").map(d => d.trim()).filter(Boolean);
      const { data, error } = await supabase.from("widget_settings").upsert({
        branch_id: branchId,
        allowed_domains: domainsArray,
        header_color: headerColor,
        button_color: buttonColor,
        text_color: textColor,
      }, { onConflict: "branch_id" }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["widgetSettings", branchId] });
      toast({ title: "Widget settings updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const embedSnippet = branchId ?
    `<script src="https://partners.eduforyou.co.uk/widget-script.js?branch=${branchId}"></script>` :
    "Loading widget snippet...";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedSnippet);
    toast({ title: "Copied to clipboard", description: "Embed snippet copied successfully." });
  };

  if (isLoadingBranch || isLoadingConsultants || isLoadingWidgetSettings) return <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}><div>Loading...</div></DashboardLayout>;
  if (branchError) return <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}><div>Error loading branch: {branchError.message}</div></DashboardLayout>;
  if (consultantsError) return <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}><div>Error loading consultants: {consultantsError.message}</div></DashboardLayout>;
  if (widgetSettingsError) console.error("Widget settings error:", widgetSettingsError); // Log error but don't block UI
  if (!branch) return <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}><div>Branch not found.</div></DashboardLayout>;

  return (
    <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{branch.name}</h1>
        <p className="text-muted-foreground">Manager: {branch.profiles?.full_name || 'N/A'}</p>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Consultants</CardTitle>
            <Button asChild size="sm">
              <Link to={`/company/branches/${branchId}/consultants/new`}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Consultant
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {consultants && consultants.length > 0 ? (
              <div className="grid gap-4">
                {consultants.map((consultant) => (
                  <Card key={consultant.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{consultant.full_name}</h3>
                        <p className="text-sm text-muted-foreground">Email: {consultant.email}</p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/company/consultants/${consultant.id}`}>View Consultant</Link>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No consultants in this branch yet. Add your first consultant to get started.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Widget Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="allowedDomains">Allowed Domains (comma-separated)</Label>
              <Input
                id="allowedDomains"
                value={allowedDomains}
                onChange={(e) => setAllowedDomains(e.target.value)}
                placeholder="example.com, another.org"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="headerColor">Header Color</Label>
                <Input
                  id="headerColor"
                  type="color"
                  value={headerColor}
                  onChange={(e) => setHeaderColor(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="buttonColor">Button Color</Label>
                <Input
                  id="buttonColor"
                  type="color"
                  value={buttonColor}
                  onChange={(e) => setButtonColor(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="textColor">Text Color</Label>
                <Input
                  id="textColor"
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={() => updateWidgetSettings.mutate()}
              disabled={updateWidgetSettings.isPending}
            >
              {updateWidgetSettings.isPending ? "Saving..." : "Save Widget Settings"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Embed Widget Snippet</CardTitle>
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              <Copy className="mr-2 h-4 w-4" /> Copy Snippet
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-x-auto">
              <code>{embedSnippet}</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
