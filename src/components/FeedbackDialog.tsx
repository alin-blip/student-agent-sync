import { useState } from "react";
import { MessageSquareHeart } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const categories = [
  { value: "suggestion", label: "Suggestion" },
  { value: "bug", label: "Bug / Issue" },
  { value: "simplify", label: "Simplification" },
  { value: "feature", label: "New Feature" },
];

export function FeedbackDialog({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("suggestion");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!message.trim() || !user) return;
    setLoading(true);
    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      category,
      message: message.trim(),
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: "Could not send feedback.", variant: "destructive" });
    } else {
      toast({ title: "Thank you!", description: "Your feedback has been sent." });
      setMessage("");
      setCategory("suggestion");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent">
            <MessageSquareHeart className="h-4 w-4 mr-2" />
            Help us improve
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Help us improve the platform</DialogTitle>
          <DialogDescription>Tell us what we can improve, simplify or add.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              placeholder="Describe your idea or issue..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1000}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={loading || !message.trim()}>
            {loading ? "Sending..." : "Send feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
