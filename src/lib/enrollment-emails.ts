import { supabase } from "@/integrations/supabase/client";

export async function notifyAgentOfStatusChange(
  enrollmentId: string,
  newStatus: string,
  oldStatus: string,
  changedByName?: string
) {
  try {
    // Fetch enrollment with student + university + course info
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("student_id, students!inner(first_name, last_name, agent_id), universities!inner(name), courses!inner(name)")
      .eq("id", enrollmentId)
      .single();

    if (!enrollment) return;

    const student = (enrollment as any).students;
    const agentId = student?.agent_id;
    if (!agentId) return;

    // Fetch agent email
    const { data: agent } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", agentId)
      .single();

    if (!agent?.email) return;

    const studentName = `${student.first_name} ${student.last_name}`;
    const universityName = (enrollment as any).universities?.name;
    const courseName = (enrollment as any).courses?.name;
    const studentUrl = `${window.location.origin}/consultant/students/${enrollment.student_id}`;

    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "enrollment-status-change",
        recipientEmail: agent.email,
        idempotencyKey: `enrollment-status-${enrollmentId}-${newStatus}-${Date.now()}`,
        templateData: {
          studentName,
          universityName,
          courseName,
          oldStatus,
          newStatus,
          changedBy: changedByName || "System",
          studentUrl,
        },
      },
    });
  } catch (err) {
    console.error("Failed to send enrollment status change email:", err);
  }
}
