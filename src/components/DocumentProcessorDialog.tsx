import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, Loader2, FileText, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type DocType = "courses" | "timetable" | "campuses" | "intakes" | "course_timetable" | "course_details";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  universities: { id: string; name: string }[];
  defaultDocType?: DocType;
}

const DOC_TYPE_LABELS: Record<DocType, string> = {
  courses: "Courses",
  timetable: "Timetable Options",
  campuses: "Campuses",
  intakes: "Intakes",
  course_timetable: "Course–Timetable Matrix",
  course_details: "Course Details (Requirements)",
};

const COLUMNS: Record<DocType, string[]> = {
  courses: ["name", "level", "study_mode"],
  timetable: ["label"],
  campuses: ["name", "city"],
  intakes: ["label", "start_date", "application_deadline"],
  course_timetable: ["course_name", "campus", "groups"],
  course_details: ["course_name", "entry_requirements", "admission_test_info", "interview_info", "documents_required", "personal_statement_guidelines", "additional_info"],
};

const ALL_DOC_TYPES: DocType[] = ["courses", "campuses", "intakes", "timetable", "course_timetable", "course_details"];

const ACCEPTED = ".pdf,.xlsx,.xls,.docx,.jpg,.jpeg,.png,.webp";

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const EMPTY_ITEMS: Record<DocType, any[]> = {
  courses: [], timetable: [], campuses: [], intakes: [], course_timetable: [], course_details: [],
};
const EMPTY_SELECTED: Record<DocType, Set<number>> = {
  courses: new Set(), timetable: new Set(), campuses: new Set(), intakes: new Set(), course_timetable: new Set(), course_details: new Set(),
};
const EMPTY_SUMMARY: Record<DocType, number> = { courses: 0, timetable: 0, campuses: 0, intakes: 0, course_timetable: 0, course_details: 0 };

export function DocumentProcessorDialog({ open, onOpenChange, universities, defaultDocType }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTypes, setSelectedTypes] = useState<Set<DocType>>(
    new Set(defaultDocType ? [defaultDocType] : ["courses"])
  );
  const [universityId, setUniversityId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState({ done: 0, total: 0 });
  const [itemsByType, setItemsByType] = useState<Record<DocType, any[]>>({ ...EMPTY_ITEMS });
  const [selectedByType, setSelectedByType] = useState<Record<DocType, Set<number>>>({ ...EMPTY_SELECTED });
  const [activeTab, setActiveTab] = useState<DocType>("courses");
  const [saving, setSaving] = useState(false);
  const [savedSummary, setSavedSummary] = useState<Record<DocType, number>>({ ...EMPTY_SUMMARY });
  const [saveToTables, setSaveToTables] = useState(true);
  const [saveToKBOption, setSaveToKBOption] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(1);
    setFiles([]);
    setItemsByType({ ...EMPTY_ITEMS });
    setSelectedByType({
      courses: new Set(), timetable: new Set(), campuses: new Set(), intakes: new Set(), course_timetable: new Set(), course_details: new Set(),
    });
    setProcessing(false);
    setSaving(false);
    setDragOver(false);
    setProcessProgress({ done: 0, total: 0 });
    setSavedSummary({ ...EMPTY_SUMMARY });
    setSaveToTables(true);
    setSaveToKBOption(false);
  };

  const toggleType = (type: DocType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      const unique = arr.filter((f) => !existing.has(f.name + f.size));
      return [...prev, ...unique];
    });
  }, []);

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleProcess = async () => {
    if (files.length === 0 || !universityId || selectedTypes.size === 0) return;
    setProcessing(true);

    const types = Array.from(selectedTypes);
    const totalOps = files.length * types.length;
    setProcessProgress({ done: 0, total: totalOps });

    const newItemsByType: Record<DocType, any[]> = { courses: [], timetable: [], campuses: [], intakes: [], course_timetable: [], course_details: [] };
    let doneCount = 0;

    try {
      for (const file of files) {
        const base64 = await readFileAsBase64(file);
        for (const docType of types) {
          const { data, error } = await supabase.functions.invoke("process-settings-document", {
            body: { file_base64: base64, file_type: file.type, document_type: docType },
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || `Processing failed for ${file.name} (${docType})`);

          const extracted = data.items || [];
          extracted.forEach((item: any) => { item._source = file.name; });

          // For course_timetable, stringify groups array for display
          if (docType === "course_timetable") {
            extracted.forEach((item: any) => {
              if (Array.isArray(item.groups)) {
                item.groups = item.groups.join(", ");
              }
            });
          }

          newItemsByType[docType].push(...extracted);
          doneCount++;
          setProcessProgress({ done: doneCount, total: totalOps });
        }
      }

      setItemsByType(newItemsByType);

      const newSelected: Record<DocType, Set<number>> = {
        courses: new Set(), timetable: new Set(), campuses: new Set(), intakes: new Set(), course_timetable: new Set(), course_details: new Set(),
      };
      for (const t of types) {
        newSelected[t] = new Set(newItemsByType[t].map((_: any, i: number) => i));
      }
      setSelectedByType(newSelected);

      const firstWithData = types.find((t) => newItemsByType[t].length > 0) || types[0];
      setActiveTab(firstWithData);
      setStep(2);

      const totalItems = types.reduce((sum, t) => sum + newItemsByType[t].length, 0);
      if (totalItems === 0) {
        toast({ title: "No data found", description: "AI could not extract items from the uploaded documents.", variant: "destructive" });
      } else {
        const breakdown = types
          .filter((t) => newItemsByType[t].length > 0)
          .map((t) => `${newItemsByType[t].length} ${DOC_TYPE_LABELS[t].toLowerCase()}`)
          .join(", ");
        toast({ title: `Extracted: ${breakdown}` });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to process documents", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const toggleSelect = (type: DocType, idx: number) => {
    setSelectedByType((prev) => {
      const next = new Set(prev[type]);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return { ...prev, [type]: next };
    });
  };

  const toggleAll = (type: DocType) => {
    setSelectedByType((prev) => {
      const items = itemsByType[type];
      const current = prev[type];
      const next = current.size === items.length ? new Set<number>() : new Set(items.map((_: any, i: number) => i));
      return { ...prev, [type]: next };
    });
  };

  const updateItem = (type: DocType, idx: number, field: string, value: string) => {
    setItemsByType((prev) => ({
      ...prev,
      [type]: prev[type].map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    let totalSaved = 0;
    const summary: Record<DocType, number> = { ...EMPTY_SUMMARY };

    try {
      const types = Array.from(selectedTypes);

      const selectedItemsByType: Record<DocType, any[]> = { courses: [], timetable: [], campuses: [], intakes: [], course_timetable: [], course_details: [] };
      for (const docType of types) {
        const items = itemsByType[docType];
        const sel = selectedByType[docType];
        const toInsert = items.filter((_, i) => sel.has(i));
        if (toInsert.length === 0) continue;
        selectedItemsByType[docType] = toInsert;
        summary[docType] = toInsert.length;
        totalSaved += toInsert.length;
      }

      // Save to database tables
      if (saveToTables) {
        for (const docType of types) {
          const toInsert = selectedItemsByType[docType];
          if (!toInsert || toInsert.length === 0) continue;
          const clean = toInsert.map(({ _source, ...rest }) => rest);

          if (docType === "courses") {
            // Duplicate prevention: check existing courses by name
            const { data: existingCourses } = await supabase.from("courses").select("name").eq("university_id", universityId);
            const existingNames = new Set((existingCourses || []).map((c) => c.name.toLowerCase().trim()));
            const rows = clean
              .filter((item) => !existingNames.has(item.name?.toLowerCase().trim()))
              .map((item) => ({ university_id: universityId, name: item.name, level: item.level || "undergraduate", study_mode: item.study_mode || "blended" }));
            if (rows.length > 0) {
              const { error } = await supabase.from("courses").insert(rows);
              if (error) throw error;
            }
            summary[docType] = rows.length;
            qc.invalidateQueries({ queryKey: ["all-courses"] });
          } else if (docType === "timetable") {
            const { data: existingTimetables } = await supabase.from("timetable_options").select("label").eq("university_id", universityId);
            const existingLabels = new Set((existingTimetables || []).map((t) => t.label.toLowerCase().trim()));
            const rows = clean
              .filter((item) => !existingLabels.has(item.label?.toLowerCase().trim()))
              .map((item) => ({ university_id: universityId, label: item.label }));
            if (rows.length > 0) {
              const { error } = await supabase.from("timetable_options").insert(rows);
              if (error) throw error;
            }
            summary[docType] = rows.length;
            qc.invalidateQueries({ queryKey: ["timetable-options"] });
          } else if (docType === "campuses") {
            const { data: existingCampuses } = await supabase.from("campuses").select("name").eq("university_id", universityId);
            const existingNames = new Set((existingCampuses || []).map((c) => c.name.toLowerCase().trim()));
            const rows = clean
              .filter((item) => !existingNames.has(item.name?.toLowerCase().trim()))
              .map((item) => ({ university_id: universityId, name: item.name, city: item.city || null }));
            if (rows.length > 0) {
              const { error } = await supabase.from("campuses").insert(rows);
              if (error) throw error;
            }
            summary[docType] = rows.length;
            qc.invalidateQueries({ queryKey: ["all-campuses"] });
          } else if (docType === "intakes") {
            const { data: existingIntakes } = await supabase.from("intakes").select("label").eq("university_id", universityId);
            const existingLabels = new Set((existingIntakes || []).map((i) => i.label.toLowerCase().trim()));
            const rows = clean
              .filter((item) => !existingLabels.has(item.label?.toLowerCase().trim()))
              .map((item) => ({ university_id: universityId, label: item.label, start_date: item.start_date || new Date().toISOString().split("T")[0], application_deadline: item.application_deadline || null }));
            if (rows.length > 0) {
              const { error } = await supabase.from("intakes").insert(rows);
              if (error) throw error;
            }
            summary[docType] = rows.length;
            qc.invalidateQueries({ queryKey: ["all-intakes"] });
          } else if (docType === "course_timetable") {
            // Match course names and campus names to existing IDs, then insert into course_timetable_groups
            const { data: existingCourses } = await supabase.from("courses").select("id, name").eq("university_id", universityId);
            const { data: existingCampuses } = await supabase.from("campuses").select("id, name").eq("university_id", universityId);
            const { data: existingTimetables } = await supabase.from("timetable_options").select("id, label").eq("university_id", universityId);

            const courseMap = new Map((existingCourses || []).map((c) => [c.name.toLowerCase().trim(), c.id]));
            const campusMap = new Map((existingCampuses || []).map((c) => [c.name.toLowerCase().trim(), c.id]));
            // Map timetable options by single letter extracted from label (e.g. "Group A – Monday..." -> "a")
            const timetableByLetter = new Map<string, string>();
            for (const t of existingTimetables || []) {
              const match = t.label.match(/^(?:Group\s+)?([A-Z])/i);
              if (match) timetableByLetter.set(match[1].toLowerCase(), t.id);
            }

            const rows: any[] = [];
            for (const item of clean) {
              const courseId = courseMap.get(item.course_name?.toLowerCase().trim());
              const campusId = campusMap.get(item.campus?.toLowerCase().trim());
              if (!courseId) continue;

              const groupLetters = typeof item.groups === "string"
                ? item.groups.split(",").map((g: string) => g.trim().toLowerCase())
                : [];

              for (const letter of groupLetters) {
                const timetableId = timetableByLetter.get(letter);
                if (!timetableId) continue;
                rows.push({
                  course_id: courseId,
                  campus_id: campusId || null,
                  timetable_option_id: timetableId,
                  university_id: universityId,
                });
              }
            }

            if (rows.length > 0) {
              const { error } = await supabase.from("course_timetable_groups").insert(rows);
              if (error) throw error;
              qc.invalidateQueries({ queryKey: ["course-timetable-groups"] });
            }
          } else if (docType === "course_details") {
            // Match course names to existing course IDs, then upsert into course_details
            const { data: existingCourses } = await supabase.from("courses").select("id, name").eq("university_id", universityId);
            const courseMap = new Map((existingCourses || []).map((c) => [c.name.toLowerCase().trim(), c.id]));

            for (const item of clean) {
              const courseId = courseMap.get(item.course_name?.toLowerCase().trim());
              if (!courseId) continue;
              const row = {
                course_id: courseId,
                personal_statement_guidelines: item.personal_statement_guidelines || null,
                admission_test_info: item.admission_test_info || null,
                interview_info: item.interview_info || null,
                entry_requirements: item.entry_requirements || null,
                documents_required: item.documents_required || null,
                additional_info: item.additional_info || null,
              };
              const { error } = await supabase.from("course_details" as any).upsert(row, { onConflict: "course_id" });
              if (error) throw error;
            }
            qc.invalidateQueries({ queryKey: ["course-details"] });
          }
        }
      }

      // Save to Knowledge Base
      if (saveToKBOption) {
        const kbEntries = types
          .filter((t) => selectedItemsByType[t]?.length > 0)
          .map((docType) => {
            const saved = selectedItemsByType[docType];
            let content = "";
            if (docType === "courses") {
              content = saved.map((c) => `- ${c.name} (${c.level}, ${c.study_mode})`).join("\n");
            } else if (docType === "campuses") {
              content = saved.map((c) => `- ${c.name}${c.city ? ` — ${c.city}` : ""}`).join("\n");
            } else if (docType === "intakes") {
              content = saved.map((c) => `- ${c.label} (starts ${c.start_date}${c.application_deadline ? `, deadline ${c.application_deadline}` : ""})`).join("\n");
            } else if (docType === "timetable") {
              content = saved.map((c) => `- ${c.label}`).join("\n");
            } else if (docType === "course_timetable") {
              content = saved.map((c) => `- ${c.course_name} @ ${c.campus}: Groups ${c.groups}`).join("\n");
            } else if (docType === "course_details") {
              content = saved.map((c) => `- ${c.course_name}: Entry=${c.entry_requirements || "N/A"}, Test=${c.admission_test_info || "N/A"}, PS=${c.personal_statement_guidelines || "N/A"}`).join("\n");
            }
            return { title: `${universityName} — ${DOC_TYPE_LABELS[docType]}`, content, category: docType === "course_timetable" ? "timetable" : docType };
          });

        if (kbEntries.length > 0) {
          const { error } = await supabase.from("ai_knowledge_base").insert(kbEntries);
          if (error) throw error;
          qc.invalidateQueries({ queryKey: ["knowledge-base"] });
        }
      }

      setSavedSummary(summary);
      const parts: string[] = [];
      if (saveToTables) parts.push("database");
      if (saveToKBOption) parts.push("Knowledge Base");
      toast({ title: `${totalSaved} items saved to ${parts.join(" & ")}` });
      setStep(3);
    } catch (err: any) {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const universityName = universities.find((u) => u.id === universityId)?.name || "University";

  const typesWithItems = Array.from(selectedTypes).filter((t) => itemsByType[t].length > 0);
  const totalSelected = Array.from(selectedTypes).reduce((sum, t) => sum + selectedByType[t].size, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Import from Document"}
            {step === 2 && "Review Extracted Data"}
            {step === 3 && "Import Complete"}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>What to extract (select one or more)</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_DOC_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors
                      ${selectedTypes.has(type)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                      }`}
                  >
                    {selectedTypes.has(type) && <Check className="h-3 w-3" />}
                    {DOC_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>University</Label>
              <Select value={universityId} onValueChange={setUniversityId}>
                <SelectTrigger><SelectValue placeholder="Select university" /></SelectTrigger>
                <SelectContent>
                  {universities.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Upload Files (PDF, DOCX, XLSX, Image)</Label>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
                  ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED}
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }}
                />
                <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Drag & drop files here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Support for multiple files · PDF, DOCX, XLSX, JPG, PNG
                </p>
              </div>

              {files.length > 0 && (
                <div className="space-y-1 mt-2">
                  {files.map((f, idx) => (
                    <div key={f.name + f.size} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-1.5">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-xs shrink-0">({(f.size / 1024).toFixed(0)} KB)</span>
                      <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="shrink-0 hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={handleProcess} disabled={files.length === 0 || !universityId || processing || selectedTypes.size === 0} className="w-full">
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing {processProgress.done}/{processProgress.total}...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Process {files.length > 0 ? `${files.length} Document${files.length > 1 ? "s" : ""}` : "Documents"}
                  {selectedTypes.size > 1 && ` × ${selectedTypes.size} types`}
                </>
              )}
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Review extracted data across {typesWithItems.length} categor{typesWithItems.length === 1 ? "y" : "ies"}.
              Edit if needed, then confirm.
            </p>

            {typesWithItems.length > 0 ? (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DocType)}>
                <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
                  {typesWithItems.map((type) => (
                    <TabsTrigger key={type} value={type} className="gap-1.5">
                      {DOC_TYPE_LABELS[type]}
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {selectedByType[type].size}/{itemsByType[type].length}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {typesWithItems.map((type) => {
                  const cols = COLUMNS[type];
                  const items = itemsByType[type];
                  const sel = selectedByType[type];

                  return (
                    <TabsContent key={type} value={type}>
                      <div className="max-h-[40vh] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">
                                <Checkbox
                                  checked={sel.size === items.length && items.length > 0}
                                  onCheckedChange={() => toggleAll(type)}
                                />
                              </TableHead>
                              {cols.map((c) => (
                                <TableHead key={c} className="capitalize">{c.replace(/_/g, " ")}</TableHead>
                              ))}
                              <TableHead>Source</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {items.map((item, idx) => (
                              <TableRow key={idx}>
                                <TableCell>
                                  <Checkbox checked={sel.has(idx)} onCheckedChange={() => toggleSelect(type, idx)} />
                                </TableCell>
                                {cols.map((col) => (
                                  <TableCell key={col}>
                                    <Input
                                      value={item[col] || ""}
                                      onChange={(e) => updateItem(type, idx, col, e.target.value)}
                                      className="h-8 text-sm"
                                    />
                                  </TableCell>
                                ))}
                                <TableCell>
                                  <span className="text-xs text-muted-foreground truncate max-w-[120px] block">{item._source}</span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            ) : (
              <p className="text-center py-8 text-muted-foreground">No data extracted from the uploaded documents.</p>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4 border rounded-lg p-3 bg-muted/30">
                <Label className="text-sm font-medium shrink-0">Save to:</Label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={saveToTables}
                      onCheckedChange={(v) => setSaveToTables(!!v)}
                    />
                    Database (Courses, Campuses, etc.)
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={saveToKBOption}
                      onCheckedChange={(v) => setSaveToKBOption(!!v)}
                    />
                    Knowledge Base (AI)
                  </label>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={handleSave} disabled={totalSelected === 0 || saving || (!saveToTables && !saveToKBOption)}>
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <>Save {totalSelected} Selected</>}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 py-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium">Import Complete!</p>
              <p className="text-sm text-muted-foreground mt-1">{universityName}</p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-sm font-medium mb-2">Summary</p>
              {Array.from(selectedTypes)
                .filter((t) => savedSummary[t] > 0)
                .map((t) => (
                  <div key={t} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    <span>{savedSummary[t]} {DOC_TYPE_LABELS[t]}</span>
                  </div>
                ))}
              <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t">
                {saveToTables && <Badge variant="secondary">Database</Badge>}
                {saveToKBOption && <Badge variant="secondary">Knowledge Base</Badge>}
              </div>
            </div>

            <Button onClick={() => { reset(); onOpenChange(false); }} className="w-full">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
