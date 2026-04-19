import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Trash2, FileText, RefreshCw, ShieldCheck, Eye, Archive, Send, Copy, Check, Loader2, ExternalLink, Mail, FolderUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { SignatureCanvas } from "@/components/SignatureCanvas";
import { syncToDrive } from "@/lib/drive-sync";
import JSZip from "jszip";

const DOC_TYPES = ["Passport", "Transcript", "Offer Letter", "Visa", "Qualification Certificate", "Share Code", "Proof of Address", "Other"];

import { CONSENT_CLAUSES, MARKETING_OPTIONS, DEFAULT_MARKETING_CHECKS } from "@/lib/consent-clauses";

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
}

interface Props {
  student: any;
  canEdit: boolean;
}

export function StudentDocumentsTab({ student, canEdit }: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState("Passport");

  // Re-generate consent state
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [consentChecks, setConsentChecks] = useState<Record<string, boolean>>({});
  const [marketingChecks, setMarketingChecks] = useState<Record<string, boolean>>(DEFAULT_MARKETING_CHECKS);
  const [consentSignature, setConsentSignature] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // Consent link state
  const [sendingLink, setSendingLink] = useState(false);
  const [consentLink, setConsentLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [emailingLink, setEmailingLink] = useState(false);
  const [emailingRegent, setEmailingRegent] = useState(false);

  // Document upload request state
  const [docRequestOpen, setDocRequestOpen] = useState(false);
  const [requestedDocTypes, setRequestedDocTypes] = useState<Record<string, boolean>>({});
  const [requestMessage, setRequestMessage] = useState("");
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [emailingRequest, setEmailingRequest] = useState(false);
  const [docRequestLink, setDocRequestLink] = useState<string | null>(null);
  const [requestLinkCopied, setRequestLinkCopied] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteCodeDialogOpen, setDeleteCodeDialogOpen] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [requestingCode, setRequestingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);

  const nonMarketingClauses = CONSENT_CLAUSES.filter((c) => !c.isMarketing);
  const allConsentsChecked = nonMarketingClauses.every((c) => consentChecks[c.id]);
  const canSubmitConsent = allConsentsChecked && consentSignature.trim().length > 0 && !!signatureDataUrl;

  const { data: documents = [], refetch: refetchDocs } = useQuery({
    queryKey: ["student-documents", student.id],
    queryFn: async () => {
      const { data } = await supabase.from("student_documents").select("*").eq("student_id", student.id).eq("is_current", true).is("cancelled_at" as any, null).order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Cancelled documents query (owner/admin only)
  const { data: cancelledDocs = [], refetch: refetchCancelled } = useQuery({
    queryKey: ["student-documents-cancelled", student.id],
    queryFn: async () => {
      const { data } = await supabase.from("student_documents").select("*").eq("student_id", student.id).not("cancelled_at" as any, "is", null).order("cancelled_at" as any, { ascending: false });
      return data || [];
    },
    enabled: role === "owner" || role === "branch_manager",
  });

  const handleRestoreDoc = async (doc: any) => {
    const { error } = await supabase.from("student_documents").update({
      cancelled_at: null,
      cancelled_by: null,
    } as any).eq("id", doc.id);
    if (error) {
      toast({ title: "Restore failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Document restored" });
      refetchDocs();
      refetchCancelled();
    }
  };

  const { data: agentProfile } = useQuery({
    queryKey: ["agent-profile", student.agent_id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", student.agent_id).single();
      return data;
    },
    enabled: !!student.agent_id,
  });

  // Fetch enrollments for consent PDF context and Regent check
  const { data: enrollments = [] } = useQuery({
    queryKey: ["student-enrollments-for-consent", student.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("*, universities(id, name), courses(name)")
        .eq("student_id", student.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const REGENT_UNIVERSITY_ID = "46b1ee8a-1371-42f1-854a-f2ff7f84c8af";
  const REGENT_APPLICATION_FORM_URL = "https://forms.office.com/Pages/ResponsePage.aspx?id=v1F5UO4QvUicmtQlwrB3iVBDDnirEVBFnLkgzZ2NVK1UOUcxQURDQjg4QVBYV1FORTZKU0kyUERJNi4u";
  const isRegentStudent = enrollments.some((e: any) => e.universities?.id === REGENT_UNIVERSITY_ID || e.university_id === REGENT_UNIVERSITY_ID);

  const getConsentPdfBody = async () => {
    const enrollment = enrollments[0] as any;
    const universityName = enrollment?.universities?.name || "N/A";
    const courseName = enrollment?.courses?.name || "N/A";
    
    // Extract raw RGB from signature canvas for PDF embedding
    let signatureRgb: string | null = null;
    let sigWidth: number | null = null;
    let sigHeight: number | null = null;
    
    if (signatureDataUrl) {
      const { extractSignatureRgb } = await import("@/lib/signature-utils");
      const result = await extractSignatureRgb(signatureDataUrl, 400, 120);
      if (result) {
        signatureRgb = result.rgb;
        sigWidth = result.width;
        sigHeight = result.height;
      }
    }
    
    return {
      studentName: `${student.title ? student.title + " " : ""}${student.first_name} ${student.last_name}`,
      dateOfBirth: student.date_of_birth || null,
      nationality: student.nationality || null,
      address: student.full_address || null,
      universityName,
      courseName,
      agentName: agentProfile?.full_name || "EduForYou UK",
      signature: consentSignature,
      signatureImage: signatureDataUrl || null,
      signatureRgb,
      signatureWidth: sigWidth,
      signatureHeight: sigHeight,
      consentDate: new Date().toLocaleDateString("en-GB"),
      marketingConsent: marketingChecks,
    };
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const storagePath = `${student.id}/${selectedDocType}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("student-documents").upload(storagePath, file);
      if (uploadError) throw uploadError;

      // Mark previous versions of same doc type as not current
      const { data: existingDocs } = await supabase
        .from("student_documents")
        .select("id, version")
        .eq("student_id", student.id)
        .eq("doc_type", selectedDocType)
        .eq("is_current", true);
      
      const nextVersion = existingDocs && existingDocs.length > 0
        ? Math.max(...existingDocs.map((d: any) => d.version)) + 1
        : 1;

      if (existingDocs && existingDocs.length > 0) {
        await supabase
          .from("student_documents")
          .update({ is_current: false } as any)
          .eq("student_id", student.id)
          .eq("doc_type", selectedDocType)
          .eq("is_current", true);
      }

      const { error: dbError } = await supabase.from("student_documents").insert({
        student_id: student.id, agent_id: student.agent_id, doc_type: selectedDocType,
        file_name: file.name, file_path: storagePath, file_size: file.size, uploaded_by: user.id,
        version: nextVersion, is_current: true,
      });
      if (dbError) throw dbError;
      toast({ title: "Document uploaded" });
      refetchDocs();
      // Sync to Google Drive
      syncToDrive("document_uploaded", student.id, undefined);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from("student-documents").download(doc.file_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a"); a.href = url; a.download = doc.file_name; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDeleteDoc = async (doc: any) => {
    // Agents cannot cancel or delete documents
    if (role === "consultant") return;

    if (role === "branch_manager") {
      // Admin needs code from owner
      setDeleteTarget(doc);
      setDeleteCodeDialogOpen(true);
      setDeleteCode("");
      setCodeRequested(false);
      return;
    }

    // Owner: direct delete
    setDeleteTarget(doc);
    setDeleteDialogOpen(true);
  };

  const handleOwnerDelete = async () => {
    if (!deleteTarget) return;
    await supabase.storage.from("student-documents").remove([deleteTarget.file_path]);
    const { error } = await supabase.from("student_documents").delete().eq("id", deleteTarget.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Document deleted" }); refetchDocs(); }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleRequestDeleteCode = async () => {
    if (!deleteTarget) return;
    setRequestingCode(true);
    try {
      const { error } = await supabase.functions.invoke("request-delete-code", {
        body: { entity_type: "document", entity_id: deleteTarget.id },
      });
      if (error) throw error;
      setCodeRequested(true);
      toast({ title: "Code requested", description: "A deletion code has been sent to the owner." });
    } catch (err: any) {
      toast({ title: "Request failed", description: err.message, variant: "destructive" });
    } finally {
      setRequestingCode(false);
    }
  };

  const handleVerifyDeleteCode = async () => {
    if (!deleteTarget || !deleteCode) return;
    setVerifyingCode(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-delete-code", {
        body: { entity_id: deleteTarget.id, code: deleteCode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Document deleted" });
      refetchDocs();
      setDeleteCodeDialogOpen(false);
      setDeleteTarget(null);
      setDeleteCode("");
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setVerifyingCode(false);
    }
  };

  const [downloadingAll, setDownloadingAll] = useState(false);

  const handleDownloadAll = async () => {
    if (documents.length === 0) return;
    setDownloadingAll(true);
    try {
      const zip = new JSZip();
      for (const doc of documents) {
        const { data } = await supabase.storage.from("student-documents").download(doc.file_path);
        if (data) {
          zip.file(doc.file_name, data);
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${student.first_name}_${student.last_name}_Documents.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download started", description: `${documents.length} documents zipped.` });
    } catch (err: any) {
      toast({ title: "Download failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingAll(false);
    }
  };

  const handlePreviewConsent = async () => {
    if (!canSubmitConsent) return;
    setPreviewing(true);
    try {
      const { data: pdfData, error: pdfError } = await supabase.functions.invoke("generate-consent-pdf", {
        body: getConsentPdfBody(),
      });
      if (pdfError) throw pdfError;

      const base64 = pdfData.pdf_base64;
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pdfBlob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlob);
      setPreviewUrl(url);
    } catch (err: any) {
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  const handleReGenerateConsent = async () => {
    if (!user || !canSubmitConsent) return;
    setGenerating(true);
    try {
      const { data: pdfData, error: pdfError } = await supabase.functions.invoke("generate-consent-pdf", {
        body: getConsentPdfBody(),
      });

      if (pdfError) throw pdfError;

      const base64 = pdfData.pdf_base64;
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const pdfBlob = new Blob([bytes], { type: "application/pdf" });

      const storagePath = `${student.id}/Consent_Form_${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("student-documents")
        .upload(storagePath, pdfBlob, { contentType: "application/pdf" });
      if (uploadError) throw uploadError;

      await supabase.from("student_documents").insert({
        student_id: student.id,
        agent_id: student.agent_id,
        doc_type: "Consent Form",
        file_name: `EduForYou_Consent_Form_${student.first_name}_${student.last_name}.pdf`,
        file_path: storagePath,
        file_size: pdfBlob.size,
        uploaded_by: user.id,
      });

      toast({ title: "Consent form re-generated", description: "New consent form PDF has been created and saved." });
      setConsentDialogOpen(false);
      setConsentChecks({});
      setConsentSignature("");
      setSignatureDataUrl(null);
      setPreviewUrl(null);
      refetchDocs();
      queryClient.invalidateQueries({ queryKey: ["student-consent-status", student.id] });
      // Sync to Google Drive
      syncToDrive("consent_generated", student.id);
    } catch (err: any) {
      toast({ title: "Failed to generate consent form", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendConsentLink = async () => {
    setSendingLink(true);
    setConsentLink(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-consent-token", {
        body: { student_id: student.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setConsentLink(data.signing_url);
      toast({ title: "Consent link created", description: "Copy the link and send it to the student." });
    } catch (err: any) {
      toast({ title: "Failed to create link", description: err.message, variant: "destructive" });
    } finally {
      setSendingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (!consentLink) return;
    navigator.clipboard.writeText(consentLink);
    setLinkCopied(true);
    toast({ title: "Link copied to clipboard" });
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleEmailConsentLink = async () => {
    if (!student.email) {
      toast({ title: "No email address", description: "This student doesn't have an email address on file.", variant: "destructive" });
      return;
    }
    setEmailingLink(true);
    try {
      // First create the token
      const { data, error } = await supabase.functions.invoke("create-consent-token", {
        body: { student_id: student.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const signingUrl = data.signing_url;
      const studentName = `${student.title ? student.title + " " : ""}${student.first_name} ${student.last_name}`;

      // Send the email
      const { error: emailError } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "consent-signing-link",
          recipientEmail: student.email,
          idempotencyKey: `consent-link-${data.token}`,
          templateData: {
            studentName,
            agentName: agentProfile?.full_name || "EduForYou UK",
            signingUrl,
          },
        },
      });
      if (emailError) throw emailError;

      setConsentLink(signingUrl);
      toast({ title: "Consent email sent", description: `Email sent to ${student.email} with the signing link.` });
    } catch (err: any) {
      toast({ title: "Failed to send email", description: err.message, variant: "destructive" });
    } finally {
      setEmailingLink(false);
    }
  };

  const handleEmailRegentLink = async () => {
    if (!student.email) {
      toast({ title: "No email address", description: "This student doesn't have an email address on file.", variant: "destructive" });
      return;
    }
    setEmailingRegent(true);
    try {
      const studentName = `${student.title ? student.title + " " : ""}${student.first_name} ${student.last_name}`;
      const { error: emailError } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "regent-application-link",
          recipientEmail: student.email,
          idempotencyKey: `regent-app-${student.id}-${Date.now()}`,
          templateData: {
            studentName,
            agentName: agentProfile?.full_name || "EduForYou UK",
            applicationUrl: REGENT_APPLICATION_FORM_URL,
          },
        },
      });
      if (emailError) throw emailError;
      toast({ title: "Regent form email sent", description: `Application form link sent to ${student.email}.` });
    } catch (err: any) {
      toast({ title: "Failed to send email", description: err.message, variant: "destructive" });
    } finally {
      setEmailingRegent(false);
    }
  };

  const buildDocTypesList = () => Object.entries(requestedDocTypes).filter(([, v]) => v).map(([k]) => k);

  const handleCreateDocRequest = async () => {
    const list = buildDocTypesList();
    if (list.length === 0) {
      toast({ title: "Select at least one document type", variant: "destructive" });
      return;
    }
    setCreatingRequest(true);
    setDocRequestLink(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-document-request", {
        body: { student_id: student.id, doc_types: list, message: requestMessage || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDocRequestLink(data.upload_url);
      toast({ title: "Upload link created", description: "Copy and share with the student." });
    } catch (err: any) {
      toast({ title: "Failed to create link", description: err.message, variant: "destructive" });
    } finally {
      setCreatingRequest(false);
    }
  };

  const handleEmailDocRequest = async () => {
    if (!student.email) {
      toast({ title: "No email address", description: "This student doesn't have an email on file.", variant: "destructive" });
      return;
    }
    const list = buildDocTypesList();
    if (list.length === 0) {
      toast({ title: "Select at least one document type", variant: "destructive" });
      return;
    }
    setEmailingRequest(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-document-request", {
        body: { student_id: student.id, doc_types: list, message: requestMessage || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const uploadUrl = data.upload_url;
      const studentName = `${student.title ? student.title + " " : ""}${student.first_name} ${student.last_name}`;

      const { error: emailError } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "document-upload-request",
          recipientEmail: student.email,
          idempotencyKey: `doc-request-${data.token}`,
          templateData: {
            studentName,
            agentName: agentProfile?.full_name || "EduForYou UK",
            uploadUrl,
            docTypes: list,
            message: requestMessage || null,
          },
        },
      });
      if (emailError) throw emailError;
      setDocRequestLink(uploadUrl);
      toast({ title: "Email sent", description: `Upload link sent to ${student.email}.` });
    } catch (err: any) {
      toast({ title: "Failed to send email", description: err.message, variant: "destructive" });
    } finally {
      setEmailingRequest(false);
    }
  };

  const handleCopyRequestLink = () => {
    if (!docRequestLink) return;
    navigator.clipboard.writeText(docRequestLink);
    setRequestLinkCopied(true);
    toast({ title: "Link copied to clipboard" });
    setTimeout(() => setRequestLinkCopied(false), 2000);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Documents</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {documents.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleDownloadAll} disabled={downloadingAll}>
                <Archive className="w-3 h-3 mr-1" /> {downloadingAll ? "Zipping…" : "Download All"}
              </Button>
            )}
            {canEdit && (
              <>
                <Button size="sm" variant="outline" onClick={handleSendConsentLink} disabled={sendingLink || emailingLink}>
                  {sendingLink ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
                  Get Link
                </Button>
                <Button size="sm" variant="outline" onClick={handleEmailConsentLink} disabled={emailingLink || sendingLink || !student.email}>
                  {emailingLink ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Mail className="w-3 h-3 mr-1" />}
                  Email Link
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setDocRequestOpen(true); setDocRequestLink(null); setRequestedDocTypes({}); setRequestMessage(""); }}>
                  <FolderUp className="w-3 h-3 mr-1" /> Request Documents
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConsentDialogOpen(true)}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Re-generate Consent
                </Button>
                <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                  <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="w-3 h-3 mr-1" /> {uploading ? "Uploading…" : "Upload"}
                </Button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {isRegentStudent && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/5">
              <a
                href={REGENT_APPLICATION_FORM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:opacity-80 transition-opacity flex-1 min-w-0"
              >
                <FileText className="w-4 h-4 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">Regent Application Form</p>
                  <p className="text-xs text-muted-foreground">Complete the online application form for Regent University</p>
                </div>
                <ExternalLink className="w-4 h-4 text-primary shrink-0" />
              </a>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-3 shrink-0"
                  onClick={handleEmailRegentLink}
                  disabled={emailingRegent || !student.email}
                >
                  {emailingRegent ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Mail className="w-3 h-3 mr-1" />}
                  Email Link
                </Button>
              )}
            </div>
          )}

          {documents.length === 0 && !isRegentStudent ? (
            <p className="text-sm text-muted-foreground text-center py-6">No documents uploaded</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    {doc.doc_type === "Consent Form" ? (
                      <ShieldCheck className="w-4 h-4 text-accent" />
                    ) : (
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{doc.doc_type} {doc.version > 1 && <span className="text-xs text-muted-foreground font-normal ml-1">v{doc.version}</span>}</p>
                      <p className="text-xs text-muted-foreground">{doc.file_name} {doc.file_size ? `• ${(doc.file_size / 1024).toFixed(0)} KB` : ""}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(doc.created_at), "dd MMM yyyy HH:mm")}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 items-center">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}><Download className="w-3.5 h-3.5" /></Button>
                    {canEdit && (role === "owner" || role === "branch_manager") && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteDoc(doc)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancelled Documents Section — owner/admin only */}
      {(role === "owner" || role === "branch_manager") && cancelledDocs.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-orange-700">
              <Archive className="w-4 h-4" />
              Cancelled Documents ({cancelledDocs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cancelledDocs.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-orange-200 bg-background/80">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground opacity-50" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{doc.doc_type}</p>
                    <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                    <p className="text-xs text-orange-600">
                      Cancelled {doc.cancelled_at ? format(new Date(doc.cancelled_at), "dd MMM yyyy HH:mm") : ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => handleRestoreDoc(doc)}>
                    <RefreshCw className="w-3 h-3" /> Restore
                  </Button>
                  {role === "owner" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDeleteTarget(doc); setDeleteDialogOpen(true); }}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {consentLink && (
        <Card className="border-accent/50">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium mb-1">Consent Signing Link</p>
                <p className="text-xs text-muted-foreground truncate">{consentLink}</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleCopyLink}>
                {linkCopied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                {linkCopied ? "Copied" : "Copy"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Re-generate Consent Form Dialog */}
      <Dialog open={consentDialogOpen} onOpenChange={(o) => { if (!o) { setPreviewUrl(null); } setConsentDialogOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-accent" />
              Re-generate Consent Form
            </DialogTitle>
          </DialogHeader>

          {previewUrl ? (
            <div className="space-y-3">
              <iframe src={previewUrl} className="w-full h-[500px] rounded-lg border" title="Consent PDF Preview" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPreviewUrl(null)}>Back to Edit</Button>
                <Button
                  onClick={handleReGenerateConsent}
                  disabled={generating}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {generating ? "Saving…" : "Save Consent Form"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                This will create a new consent form PDF for <strong>{student.first_name} {student.last_name}</strong>. 
                The student must agree to all declarations and sign again.
              </p>

              <div className="space-y-3">
                {CONSENT_CLAUSES.map((clause) => (
                  <div key={clause.id} className="space-y-1 p-3 rounded-lg border bg-muted/20">
                    {clause.isMarketing ? (
                      <div>
                        <p className="text-sm font-semibold">{clause.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1 mb-2">{clause.text}</p>
                        <div className="space-y-2 ml-1">
                          {MARKETING_OPTIONS.map((opt) => (
                            <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
                              <Checkbox
                                checked={!!marketingChecks[opt.id]}
                                disabled={!!opt.required}
                                onCheckedChange={(checked) => {
                                  if (opt.required) return;
                                  setMarketingChecks((prev) => {
                                    const next = { ...prev, [opt.id]: !!checked };
                                    if (checked && opt.exclusive) next[opt.exclusive] = false;
                                    return next;
                                  });
                                }}
                              />
                              <span className="text-xs text-foreground">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={!!consentChecks[clause.id]}
                          onCheckedChange={(checked) =>
                            setConsentChecks((prev) => ({ ...prev, [clause.id]: !!checked }))
                          }
                          className="mt-0.5"
                        />
                        <div>
                          <p className="text-sm font-semibold">{clause.title}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-1">{clause.text}</p>
                          {clause.bullets && (
                            <ul className="list-disc list-inside text-xs text-muted-foreground mt-1 space-y-0.5">
                              {clause.bullets.map((b, i) => <li key={i}>{b}</li>)}
                            </ul>
                          )}
                        </div>
                      </label>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Full Name (typed confirmation) *</Label>
                <Input
                  value={consentSignature}
                  onChange={(e) => setConsentSignature(e.target.value)}
                  placeholder={`e.g. ${student.first_name} ${student.last_name}`}
                />
              </div>

              <div className="space-y-2">
                <Label>Signature (draw below) *</Label>
                <SignatureCanvas onSignatureChange={setSignatureDataUrl} width={400} height={120} />
                <p className="text-xs text-muted-foreground">
                  Date: {new Date().toLocaleDateString("en-GB")}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setConsentDialogOpen(false)}>Cancel</Button>
                <Button
                  variant="outline"
                  onClick={handlePreviewConsent}
                  disabled={!canSubmitConsent || previewing}
                >
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  {previewing ? "Loading…" : "Preview PDF"}
                </Button>
                <Button
                  onClick={handleReGenerateConsent}
                  disabled={!canSubmitConsent || generating}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {generating ? "Generating…" : "Generate & Save"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Owner delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.file_name}</strong> from storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleOwnerDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin delete code verification */}
      <Dialog open={deleteCodeDialogOpen} onOpenChange={setDeleteCodeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-destructive" />
              Delete requires owner approval
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To delete <strong>{deleteTarget?.file_name}</strong>, you need a confirmation code from the owner.
            </p>
            {!codeRequested ? (
              <Button onClick={handleRequestDeleteCode} disabled={requestingCode} className="w-full">
                {requestingCode ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                {requestingCode ? "Sending…" : "Request code from owner"}
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-green-600 font-medium">✓ Code sent to owner. Enter it below:</p>
                <Input
                  placeholder="Enter 6-character code"
                  value={deleteCode}
                  onChange={(e) => setDeleteCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="text-center text-lg tracking-widest font-mono"
                />
                <Button
                  onClick={handleVerifyDeleteCode}
                  disabled={verifyingCode || deleteCode.length < 6}
                  className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {verifyingCode ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {verifyingCode ? "Verifying…" : "Confirm delete"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Request Documents from Student Dialog */}
      <Dialog open={docRequestOpen} onOpenChange={setDocRequestOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderUp className="w-5 h-5 text-primary" />
              Request Documents from Student
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Send a secure upload link to <strong>{student.first_name} {student.last_name}</strong>.
              The student opens the link, uploads documents, and they appear here automatically — no email attachments needed.
            </p>

            <div className="space-y-2">
              <Label>Which documents do you need?</Label>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border bg-muted/20">
                {DOC_TYPES.map((dt) => (
                  <label key={dt} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={!!requestedDocTypes[dt]}
                      onCheckedChange={(v) => setRequestedDocTypes((p) => ({ ...p, [dt]: !!v }))}
                    />
                    <span>{dt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Optional message to student</Label>
              <Textarea
                placeholder="e.g. Please make sure your passport scan is in colour and clearly readable."
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={3}
              />
            </div>

            {docRequestLink && (
              <div className="p-3 rounded-lg border border-accent/40 bg-accent/5 space-y-2">
                <p className="text-xs font-semibold text-accent">Upload link ready</p>
                <p className="text-xs text-muted-foreground break-all">{docRequestLink}</p>
                <Button size="sm" variant="outline" onClick={handleCopyRequestLink} className="w-full">
                  {requestLinkCopied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                  {requestLinkCopied ? "Copied" : "Copy link"}
                </Button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleCreateDocRequest}
                disabled={creatingRequest || emailingRequest}
                className="flex-1"
              >
                {creatingRequest ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                {creatingRequest ? "Creating…" : "Get link"}
              </Button>
              <Button
                onClick={handleEmailDocRequest}
                disabled={emailingRequest || creatingRequest || !student.email}
                className="flex-1"
              >
                {emailingRequest ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                {emailingRequest ? "Sending…" : "Send via email"}
              </Button>
            </div>
            {!student.email && (
              <p className="text-xs text-muted-foreground text-center">
                No email on file — use "Get link" and share the URL manually (WhatsApp, SMS, etc.).
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
