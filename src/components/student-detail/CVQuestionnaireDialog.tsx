import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, Loader2, Briefcase, GraduationCap, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface WorkExperience {
  jobTitle: string;
  company: string;
  companyAddress: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  isPresent: boolean;
  responsibilities: string;
}

export interface Education {
  course: string;
  school: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
  status: "complete" | "incomplete";
  diploma: "available" | "lost";
}

export interface CVQuestionnaireData {
  work_experience: {
    job_title: string;
    company: string;
    company_address: string;
    start_date: string;
    end_date: string | null;
    is_present: boolean;
    responsibilities: string;
  }[];
  education: {
    course: string;
    school: string;
    start_date: string;
    end_date: string;
    status: string;
    diploma: string;
  }[];
  skills: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CVQuestionnaireData) => void;
  generating: boolean;
}

const emptyWork = (): WorkExperience => ({
  jobTitle: "", company: "", companyAddress: "",
  startDate: undefined, endDate: undefined, isPresent: false, responsibilities: "",
});

const emptyEdu = (): Education => ({
  course: "", school: "", startDate: undefined, endDate: undefined,
  status: "complete", diploma: "available",
});

function DatePicker({ date, onSelect, disabled, placeholder }: {
  date: Date | undefined; onSelect: (d: Date | undefined) => void; disabled?: boolean; placeholder?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" disabled={disabled} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "MMM yyyy") : <span>{placeholder || "Pick a date"}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={date} onSelect={onSelect} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
  );
}

export function CVQuestionnaireDialog({ open, onOpenChange, onSubmit, generating }: Props) {
  const [workExperiences, setWorkExperiences] = useState<WorkExperience[]>([emptyWork()]);
  const [educations, setEducations] = useState<Education[]>([emptyEdu()]);
  const [skills, setSkills] = useState("");

  const updateWork = (idx: number, updates: Partial<WorkExperience>) => {
    setWorkExperiences(prev => prev.map((w, i) => i === idx ? { ...w, ...updates } : w));
  };

  const updateEdu = (idx: number, updates: Partial<Education>) => {
    setEducations(prev => prev.map((e, i) => i === idx ? { ...e, ...updates } : e));
  };

  const handleSubmit = () => {
    const data: CVQuestionnaireData = {
      work_experience: workExperiences.filter(w => w.jobTitle || w.company).map(w => ({
        job_title: w.jobTitle,
        company: w.company,
        company_address: w.companyAddress,
        start_date: w.startDate ? format(w.startDate, "yyyy-MM-dd") : "",
        end_date: w.isPresent ? null : (w.endDate ? format(w.endDate, "yyyy-MM-dd") : ""),
        is_present: w.isPresent,
        responsibilities: w.responsibilities,
      })),
      education: educations.filter(e => e.course || e.school).map(e => ({
        course: e.course,
        school: e.school,
        start_date: e.startDate ? format(e.startDate, "yyyy-MM-dd") : "",
        end_date: e.endDate ? format(e.endDate, "yyyy-MM-dd") : "",
        status: e.status,
        diploma: e.diploma,
      })),
      skills,
    };
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>CV Questionnaire</DialogTitle>
          <p className="text-sm text-muted-foreground">Fill in the details below to generate a personalised CV.</p>
        </DialogHeader>

        <Accordion type="multiple" defaultValue={["work", "education", "skills"]} className="w-full">
          {/* WORK EXPERIENCE */}
          <AccordionItem value="work">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2"><Briefcase className="w-4 h-4" /> Work Experience (last 3 years)</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {workExperiences.map((w, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Position {idx + 1}</span>
                    {workExperiences.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => setWorkExperiences(prev => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Job Title</Label>
                      <Input placeholder="e.g. Sales Assistant" value={w.jobTitle} onChange={e => updateWork(idx, { jobTitle: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Company Name</Label>
                      <Input placeholder="e.g. Tesco PLC" value={w.company} onChange={e => updateWork(idx, { company: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Company Address</Label>
                    <Input placeholder="e.g. 123 High Street, London" value={w.companyAddress} onChange={e => updateWork(idx, { companyAddress: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Start Date</Label>
                      <DatePicker date={w.startDate} onSelect={d => updateWork(idx, { startDate: d })} placeholder="Start date" />
                    </div>
                    <div>
                      <Label className="text-xs">End Date</Label>
                      <DatePicker date={w.endDate} onSelect={d => updateWork(idx, { endDate: d })} disabled={w.isPresent} placeholder={w.isPresent ? "Present" : "End date"} />
                      <div className="flex items-center gap-2 mt-1.5">
                        <Checkbox id={`present-${idx}`} checked={w.isPresent} onCheckedChange={v => updateWork(idx, { isPresent: !!v, endDate: undefined })} />
                        <Label htmlFor={`present-${idx}`} className="text-xs cursor-pointer">Currently working here</Label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Responsibilities & Activities</Label>
                    <Textarea placeholder="Describe your key responsibilities and achievements..." value={w.responsibilities} onChange={e => updateWork(idx, { responsibilities: e.target.value })} rows={3} />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={() => setWorkExperiences(prev => [...prev, emptyWork()])}>
                <Plus className="w-4 h-4 mr-1" /> Add Another Position
              </Button>
            </AccordionContent>
          </AccordionItem>

          {/* EDUCATION */}
          <AccordionItem value="education">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Education</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {educations.map((edu, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-3 bg-muted/20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Education {idx + 1}</span>
                    {educations.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => setEducations(prev => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Course / Programme</Label>
                      <Input placeholder="e.g. A-Levels" value={edu.course} onChange={e => updateEdu(idx, { course: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">School / Institution</Label>
                      <Input placeholder="e.g. Westminster College" value={edu.school} onChange={e => updateEdu(idx, { school: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Start Date</Label>
                      <DatePicker date={edu.startDate} onSelect={d => updateEdu(idx, { startDate: d })} placeholder="Start date" />
                    </div>
                    <div>
                      <Label className="text-xs">End Date</Label>
                      <DatePicker date={edu.endDate} onSelect={d => updateEdu(idx, { endDate: d })} placeholder="End date" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select value={edu.status} onValueChange={(v: "complete" | "incomplete") => updateEdu(idx, { status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="complete">Complete</SelectItem>
                          <SelectItem value="incomplete">Incomplete</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Diploma</Label>
                      <Select value={edu.diploma} onValueChange={(v: "available" | "lost") => updateEdu(idx, { diploma: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">Available</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full" onClick={() => setEducations(prev => [...prev, emptyEdu()])}>
                <Plus className="w-4 h-4 mr-1" /> Add Another Education
              </Button>
            </AccordionContent>
          </AccordionItem>

          {/* SKILLS */}
          <AccordionItem value="skills">
            <AccordionTrigger className="text-base font-semibold">
              <span className="flex items-center gap-2"><Wrench className="w-4 h-4" /> Skills</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 pt-2">
              <Textarea
                placeholder="List your skills, e.g.: Communication, Team leadership, Microsoft Office, Customer service..."
                value={skills}
                onChange={e => setSkills(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">AI will automatically match and enhance skills relevant to the student's course.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Button className="w-full mt-4" onClick={handleSubmit} disabled={generating}>
          {generating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating CV…</> : "Generate CV"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
