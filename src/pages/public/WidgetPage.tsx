import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function WidgetPage() {
  const { branchSlug } = useParams<{ branchSlug: string }>();
  const { toast } = useToast();

  const [branchId, setBranchId] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!branchSlug) return;
    (async () => {
      const { data: branchData, error: branchError } = await supabase
        .from("branches")
        .select("id")
        .eq("slug", branchSlug)
        .single();

      if (branchError || !branchData) {
        console.error("Error fetching branch:", branchError);
        setLoading(false);
        return;
      }
      setBranchId(branchData.id);

      const { data: widgetSettings, error: settingsError } = await supabase
        .from("widget_settings")
        .select("*")
        .eq("branch_id", branchData.id)
        .single();

      if (settingsError) {
        console.error("Error fetching widget settings:", settingsError);
      }
      setSettings(widgetSettings);
      setLoading(false);
    })();
  }, [branchSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;

    setSubmitting(true);
    const { error } = await supabase.functions.invoke("submit-widget-lead", {
      body: JSON.stringify({
        branch_id: branchId,
        full_name: fullName,
        email,
        phone,
        message,
        origin_domain: window.location.origin,
      }),
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Your inquiry has been submitted!" });
      setFullName("");
      setEmail("");
      setPhone("");
      setMessage("");
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading...</div>;
  }

  const headerStyle = settings?.header_color ? { backgroundColor: settings.header_color } : {};
  const buttonStyle = settings?.button_color ? { backgroundColor: settings.button_color, color: settings.text_color || '#FFFFFF' } : {};
  const textStyle = settings?.text_color ? { color: settings.text_color } : {};

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-4 text-white" style={headerStyle}>
        <h2 className="text-xl font-bold" style={textStyle}>Inquire Now</h2>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-4 flex-grow">
        <div className="grid gap-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Phone (Optional)</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="message">Message (Optional)</Label>
          <Textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" style={buttonStyle} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Inquiry"}
        </Button>
      </form>
    </div>
  );
}
