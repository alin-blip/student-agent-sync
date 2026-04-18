import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2, Building2, Landmark } from "lucide-react";

export function BillingDetailsCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    account_holder_name: "",
    sort_code: "",
    account_number: "",
    iban: "",
    swift_bic: "",
    bank_name: "",
    is_company: false,
    company_name: "",
    company_number: "",
    company_address: "",
    vat_number: "",
  });

  const { data: billing, isLoading } = useQuery({
    queryKey: ["billing-details", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_details" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (billing) {
      setForm({
        account_holder_name: billing.account_holder_name || "",
        sort_code: billing.sort_code || "",
        account_number: billing.account_number || "",
        iban: billing.iban || "",
        swift_bic: billing.swift_bic || "",
        bank_name: billing.bank_name || "",
        is_company: billing.is_company || false,
        company_name: billing.company_name || "",
        company_number: billing.company_number || "",
        company_address: billing.company_address || "",
        vat_number: billing.vat_number || "",
      });
    }
  }, [billing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, user_id: user!.id } as any;
      if (billing) {
        const { error } = await supabase
          .from("billing_details" as any)
          .update(payload)
          .eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("billing_details" as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Billing details saved" });
      qc.invalidateQueries({ queryKey: ["billing-details"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateField = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Landmark className="w-4 h-4" /> Banking & Billing Details
        </CardTitle>
        <CardDescription>Your payment details for commission invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}>
          {/* Bank Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Account Holder Name</Label>
              <Input value={form.account_holder_name} onChange={(e) => updateField("account_holder_name", e.target.value)} placeholder="Full name on account" />
            </div>
            <div className="space-y-2">
              <Label>Sort Code</Label>
              <Input value={form.sort_code} onChange={(e) => updateField("sort_code", e.target.value)} placeholder="00-00-00" />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input value={form.account_number} onChange={(e) => updateField("account_number", e.target.value)} placeholder="12345678" />
            </div>
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input value={form.bank_name} onChange={(e) => updateField("bank_name", e.target.value)} placeholder="e.g. Barclays" />
            </div>
            <div className="space-y-2">
              <Label>IBAN <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={form.iban} onChange={(e) => updateField("iban", e.target.value)} placeholder="GB..." />
            </div>
            <div className="space-y-2">
              <Label>SWIFT/BIC <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input value={form.swift_bic} onChange={(e) => updateField("swift_bic", e.target.value)} placeholder="BARCGB22" />
            </div>
          </div>

          {/* Company Toggle */}
          <div className="flex items-center gap-3 pt-2 border-t">
            <Switch checked={form.is_company} onCheckedChange={(v) => updateField("is_company", v)} />
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <Label className="cursor-pointer">I invoice through a company</Label>
            </div>
          </div>

          {/* Company Details */}
          {form.is_company && (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50 border">
              <div className="space-y-2 col-span-2">
                <Label>Company Name</Label>
                <Input value={form.company_name} onChange={(e) => updateField("company_name", e.target.value)} placeholder="Ltd / LLP name" />
              </div>
              <div className="space-y-2">
                <Label>Company Number</Label>
                <Input value={form.company_number} onChange={(e) => updateField("company_number", e.target.value)} placeholder="e.g. 12345678" />
              </div>
              <div className="space-y-2">
                <Label>VAT Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Input value={form.vat_number} onChange={(e) => updateField("vat_number", e.target.value)} placeholder="GB 123456789" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Company Address</Label>
                <Input value={form.company_address} onChange={(e) => updateField("company_address", e.target.value)} placeholder="Registered address" />
              </div>
            </div>
          )}

          <Button type="submit" disabled={saveMutation.isPending} className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Save className="w-3 h-3 mr-1" /> {saveMutation.isPending ? "Saving…" : "Save Billing Details"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
