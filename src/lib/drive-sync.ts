import { supabase } from "@/integrations/supabase/client";

export async function syncToDrive(
  action: "student_created" | "document_uploaded" | "enrollment_updated" | "consent_generated" | "full_sync",
  studentId: string,
  documentId?: string
) {
  try {
    const { error } = await supabase.functions.invoke("sync-to-drive", {
      body: { action, student_id: studentId, document_id: documentId || null },
    });
    if (error) {
      console.error("Drive sync error:", error);
    }
  } catch (err) {
    // Don't block the main flow if Drive sync fails
    console.error("Drive sync failed (non-blocking):", err);
  }
}
