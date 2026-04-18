import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Mail, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

const statusConfig: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline"; icon: React.ElementType }> = {
  sent: { label: "Sent", variant: "default", icon: CheckCircle },
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
  dlq: { label: "Failed", variant: "destructive", icon: XCircle },
  suppressed: { label: "Suppressed", variant: "outline", icon: AlertTriangle },
  bounced: { label: "Bounced", variant: "destructive", icon: AlertTriangle },
  complained: { label: "Complained", variant: "destructive", icon: AlertTriangle },
};

function templateLabel(name: string) {
  return name
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function EmailLogSection() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["email-send-log-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_send_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Deduplicate by message_id — keep latest row per message_id
  const deduplicated = (() => {
    const seen = new Map<string, any>();
    for (const log of logs) {
      const key = (log as any).message_id || (log as any).id;
      if (!seen.has(key)) {
        seen.set(key, log);
      }
    }
    return Array.from(seen.values());
  })();

  // Stats
  const total = deduplicated.length;
  const sent = deduplicated.filter((l: any) => l.status === "sent").length;
  const failed = deduplicated.filter((l: any) => ["failed", "dlq"].includes(l.status)).length;
  const pending = deduplicated.filter((l: any) => l.status === "pending").length;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Mail className="h-5 w-5" />
        Email Log
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-2xl font-bold text-green-600">{sent}</p>
            <p className="text-xs text-muted-foreground">Sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-2xl font-bold text-red-600">{failed}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Loading…
                </TableCell>
              </TableRow>
            ) : deduplicated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No emails sent yet
                </TableCell>
              </TableRow>
            ) : (
              deduplicated.map((log: any) => {
                const config = statusConfig[log.status] || statusConfig.pending;
                return (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-sm">
                      {templateLabel(log.template_name)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.recipient_email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant} className="text-xs gap-1">
                        <config.icon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(log.created_at), "dd MMM yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm text-red-600 max-w-[200px] truncate">
                      {log.error_message || "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
