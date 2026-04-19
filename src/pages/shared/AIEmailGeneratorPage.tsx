import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { APP_ROLES } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Copy, History, Mail as MailIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AIEmailGeneratorPage() {
  const { user, role, companyId, branchId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedUniversity, setSelectedUniversity] = useState<string | null>(null);
  const [selectedCampus, setSelectedCampus] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [emailType, setEmailType] = useState<"single" | "sequence">("single");
  const [sequenceLength, setSequenceLength] = useState<number>(3);
  const [audience, setAudience] = useState<string | null>(null);
  const [tone, setTone] = useState<string | null>(null);
  const [generatedEmails, setGeneratedEmails] = useState<any[]>([]);

  const { data: universities } = useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("universities").select("id, name");
      if (error) throw error;
      return data;
    },
  });

  const { data: campuses } = useQuery({
    queryKey: ["campuses", selectedUniversity],
    queryFn: async () => {
      if (!selectedUniversity) return [];
      const { data, error } = await supabase.from("campuses").select("id, name").eq("university_id", selectedUniversity);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedUniversity,
  });

  const { data: courses } = useQuery({
    queryKey: ["courses", selectedUniversity],
    queryFn: async () => {
      if (!selectedUniversity) return [];
      const { data, error } = await supabase
        .from("courses")
        .select("id, name, description, duration, timetable")
        .eq("university_id", selectedUniversity);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCampus && !!selectedUniversity,
  });

  const { data: emailHistory } = useQuery({
    queryKey: ["generatedEmailSequences", user?.id, companyId, branchId],
    queryFn: async () => {
      let query = supabase.from("generated_email_sequences").select("*").order("created_at", { ascending: false });
      if (role === APP_ROLES.COMPANY_ADMIN && companyId) {
        query = query.eq("company_id", companyId);
      } else if (role === APP_ROLES.BRANCH_MANAGER && branchId) {
        query = query.eq("branch_id", branchId);
      } else {
        query = query.eq("user_id", user?.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const generateEmailsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUniversity || !selectedCampus || !selectedCourse || !audience || !tone) {
        throw new Error("Please fill all required fields.");
      }

      const selectedCourseDetails = courses?.find(c => c.id === selectedCourse);
      if (!selectedCourseDetails) {
        throw new Error("Course details not found.");
      }

      const { data: profileData, error: profileError } = await supabase.from("profiles").select("full_name, slug").eq("id", user?.id).single();
      if (profileError) throw profileError;

      let applyLink = "";
      if (role === APP_ROLES.COMPANY_ADMIN && companyId) {
        // Logic to get company's main branch slug or a generic company link
        const { data: mainBranch, error: branchError } = await supabase.from("branches").select("slug").eq("company_id", companyId).limit(1).single();
        if (branchError) console.error("Error fetching main branch for company link:", branchError);
        applyLink = mainBranch ? `https://partners.eduforyou.co.uk/branch-card/${mainBranch.slug}` : "https://partners.eduforyou.co.uk/apply-partner";
      } else if (role === APP_ROLES.BRANCH_MANAGER && branchId) {
        const { data: currentBranch, error: branchError } = await supabase.from("branches").select("slug").eq("id", branchId).single();
        if (branchError) console.error("Error fetching current branch for link:", branchError);
        applyLink = currentBranch ? `https://partners.eduforyou.co.uk/branch-card/${currentBranch.slug}` : "https://partners.eduforyou.co.uk/apply-partner";
      } else if (role === APP_ROLES.CONSULTANT) {
        // Assuming consultant has a digital card
        applyLink = `https://partners.eduforyou.co.uk/card/${profileData?.slug ?? ""}`;
      }

      const { data, error } = await supabase.functions.invoke("generate-email-sequence", {
        body: JSON.stringify({
          university_id: selectedUniversity,
          campus_id: selectedCampus,
          course_id: selectedCourse,
          audience,
          tone,
          email_count: emailType === "sequence" ? sequenceLength : 1,
          company_name: companyId ? (await supabase.from("companies").select("name").eq("id", companyId).single()).data?.name : "EduForYou",
          branch_name: branchId ? (await supabase.from("branches").select("name").eq("id", branchId).single()).data?.name : "",
          apply_link: applyLink,
          contact_name: profileData?.full_name || "",
        }),
      });

      if (error) throw error;

      const emails = JSON.parse(data.data.emails_json);
      setGeneratedEmails(emails);

      // Save to history
      await supabase.from("generated_email_sequences").insert({
        user_id: user?.id,
        company_id: companyId,
        branch_id: branchId,
        university_id: selectedUniversity,
        campus_id: selectedCampus,
        course_id: selectedCourse,
        audience,
        tone,
        email_count: emailType === "sequence" ? sequenceLength : 1,
        emails_json: emails,
      });

      queryClient.invalidateQueries({ queryKey: ["generatedEmailSequences"] });
      toast({ title: "Emails generated successfully!" });
      return emails;
    },
    onError: (err: any) => {
      toast({ title: "Error generating emails", description: err.message, variant: "destructive" });
    },
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const currentRole = role === APP_ROLES.COMPANY_ADMIN ? APP_ROLES.COMPANY_ADMIN : APP_ROLES.BRANCH_MANAGER;

  return (
    <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN, APP_ROLES.BRANCH_MANAGER]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">AI Email Generator</h1>
        <p className="text-muted-foreground">Generate personalized emails for your network.</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="university">University</Label>
                <Select onValueChange={setSelectedUniversity} value={selectedUniversity || ""}>
                  <SelectTrigger id="university">
                    <SelectValue placeholder="Select University" />
                  </SelectTrigger>
                  <SelectContent>
                    {universities?.map((uni) => (
                      <SelectItem key={uni.id} value={uni.id}>{uni.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="campus">Campus</Label>
                <Select onValueChange={setSelectedCampus} value={selectedCampus || ""} disabled={!selectedUniversity}>
                  <SelectTrigger id="campus">
                    <SelectValue placeholder="Select Campus" />
                  </SelectTrigger>
                  <SelectContent>
                    {campuses?.map((camp) => (
                      <SelectItem key={camp.id} value={camp.id}>{camp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="course">Course</Label>
                <Select onValueChange={setSelectedCourse} value={selectedCourse || ""} disabled={!selectedCampus}>
                  <SelectTrigger id="course">
                    <SelectValue placeholder="Select Course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses?.map((course) => (
                      <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Email Type</Label>
                <RadioGroup defaultValue="single" onValueChange={(value: "single" | "sequence") => setEmailType(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="single" id="single" />
                    <Label htmlFor="single">Single Email</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sequence" id="sequence" />
                    <Label htmlFor="sequence">Email Sequence</Label>
                  </div>
                </RadioGroup>
              </div>

              {emailType === "sequence" && (
                <div className="grid gap-2">
                  <Label htmlFor="sequenceLength">Sequence Length ({sequenceLength} emails)</Label>
                  <Slider
                    id="sequenceLength"
                    min={3}
                    max={10}
                    step={1}
                    value={[sequenceLength]}
                    onValueChange={(val) => setSequenceLength(val[0])}
                    className="w-[60%]"
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="audience">Audience</Label>
                <Select onValueChange={setAudience} value={audience || ""}>
                  <SelectTrigger id="audience">
                    <SelectValue placeholder="Select Audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Network</SelectItem>
                    <SelectItem value="employees">Employees / Staff</SelectItem>
                    <SelectItem value="clients">Existing Clients</SelectItem>
                    <SelectItem value="community">Community Members</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tone">Tone</Label>
                <Select onValueChange={setTone} value={tone || ""}>
                  <SelectTrigger id="tone">
                    <SelectValue placeholder="Select Tone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly & Casual</SelectItem>
                    <SelectItem value="urgent">Urgent (deadline approaching)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={() => generateEmailsMutation.mutate()}
                disabled={generateEmailsMutation.isPending || !selectedUniversity || !selectedCampus || !selectedCourse || !audience || !tone}
                className="w-full"
              >
                {generateEmailsMutation.isPending ? "Generating..." : "Generate Emails"}
              </Button>
            </CardContent>
          </Card>

          {/* Preview Panel */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Generated Emails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {generatedEmails.length > 0 ? (
                <Tabs defaultValue={generatedEmails[0].subject} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    {generatedEmails.map((email, index) => (
                      <TabsTrigger key={index} value={email.subject}>Email {index + 1}</TabsTrigger>
                    ))}
                  </TabsList>
                  {generatedEmails.map((email, index) => (
                    <TabsContent key={index} value={email.subject}>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                          <CardTitle>{email.subject}</CardTitle>
                          <Button variant="outline" size="sm" onClick={() => handleCopy(email.body_text)}>
                            <Copy className="mr-2 h-4 w-4" /> Copy Plain Text
                          </Button>
                        </CardHeader>
                        <CardContent>
                          <div className="border rounded-md p-4 bg-gray-50 overflow-auto max-h-[400px]">
                            <div dangerouslySetInnerHTML={{ __html: email.body_html }} />
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <p className="text-muted-foreground">No emails generated yet. Use the panel on the left to configure and generate.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* History Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><History className="mr-2 h-5 w-5" /> Generation History</CardTitle>
          </CardHeader>
          <CardContent>
            {emailHistory && emailHistory.length > 0 ? (
              <div className="space-y-4">
                {emailHistory.map((historyItem: any) => (
                  <Card key={historyItem.id} className="p-4">
                    <p className="font-semibold">Generated on: {new Date(historyItem.created_at).toLocaleString()}</p>
                    <p>University: {universities?.find(u => u.id === historyItem.university_id)?.name}</p>
                    <p>Course: {courses?.find(c => c.id === historyItem.course_id)?.name}</p>
                    <p>Audience: {historyItem.audience}, Tone: {historyItem.tone}</p>
                    <p>Emails: {historyItem.email_count}</p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => setGeneratedEmails(historyItem.emails_json)}>
                      View Emails
                    </Button>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No generation history found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
