import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CourseDetailsInfoCard } from "@/components/CourseDetailsInfoCard";
import {
  Search,
  Building2,
  Clock,
  CalendarDays,
  PoundSterling,
  GraduationCap,
  Filter,
  ArrowRight,
  ScanSearch,
  Loader2,
  MapPin,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

const UNIVERSITY_URLS: Record<string, string> = {
  "global banking school": "https://globalbanking.ac.uk/",
  "qa": "https://qahighereducation.com/",
  "regent": "https://www.rcl.ac.uk/",
  "arden": "https://arden.ac.uk/",
  "lsc": "https://www.lsclondon.co.uk/",
  "uwtsd": "https://www.uwtsd.ac.uk/",
  "cecos": "https://cecos.ac.uk/",
};

function getUniversityUrl(uniName: string): string | null {
  const lower = uniName.toLowerCase();
  for (const [key, url] of Object.entries(UNIVERSITY_URLS)) {
    if (lower.startsWith(key) || lower.includes(key)) return url;
  }
  return null;
}

export default function UniversitiesCoursesPage() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const [search, setSearch] = useState(initialSearch);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedUniId, setSelectedUniId] = useState<string | null>("all");
  const [detailsCourseId, setDetailsCourseId] = useState<string | null>(null);
  const [scanningUniId, setScanningUniId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const s = searchParams.get("search");
    if (s) setSearch(s);
  }, [searchParams]);
  const { role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleScanDetails = async (uniId: string, uniName: string) => {
    const url = getUniversityUrl(uniName);

    if (!url) {
      toast({ title: "No URL configured", description: `No website URL mapped for "${uniName}"`, variant: "destructive" });
      return;
    }

    setScanningUniId(uniId);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-course-details", {
        body: { university_id: uniId, university_url: url, force: true },
      });

      if (error) throw error;

      toast({
        title: "Scan Complete",
        description: data.message || `Updated ${data.updated} courses`,
      });

      queryClient.invalidateQueries({ queryKey: ["course-details"] });
    } catch (e: any) {
      console.error("Scan error:", e);
      toast({ title: "Scan Failed", description: e.message || "Failed to scan course details", variant: "destructive" });
    } finally {
      setScanningUniId(null);
    }
  };
  const { data: universities = [] } = useQuery({
    queryKey: ["universities-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("universities")
        .select("*")
        .order("name");
      return data || [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses-all"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").order("name");
      return data || [];
    },
  });

  const { data: intakes = [] } = useQuery({
    queryKey: ["intakes-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("intakes")
        .select("*")
        .order("start_date", { ascending: false });
      return data || [];
    },
  });

  const { data: campuses = [] } = useQuery({
    queryKey: ["campuses-all"],
    queryFn: async () => {
      const { data } = await supabase.from("campuses").select("*");
      return data || [];
    },
  });

  const { data: courseTimetableGroups = [] } = useQuery({
    queryKey: ["course-timetable-groups-all"],
    queryFn: async () => {
      const { data } = await supabase.from("course_timetable_groups").select("course_id, campus_id");
      return data || [];
    },
  });

  const campusMap = new Map(campuses.map((c: any) => [c.id, c]));
  const uniCampusMap = new Map<string, { name: string; city: string | null }[]>();
  for (const c of campuses) {
    const existing = uniCampusMap.get(c.university_id) || [];
    if (!existing.some((e: any) => e.name === c.name)) {
      existing.push({ name: c.name, city: c.city });
    }
    uniCampusMap.set(c.university_id, existing);
  }
  const courseCampusMap = new Map<string, { name: string; city: string | null }[]>();
  for (const ctg of courseTimetableGroups) {
    if (!ctg.campus_id) continue;
    const campus = campusMap.get(ctg.campus_id);
    if (!campus) continue;
    const existing = courseCampusMap.get(ctg.course_id) || [];
    if (!existing.some((e) => e.name === campus.name)) {
      existing.push({ name: campus.name, city: campus.city });
    }
    courseCampusMap.set(ctg.course_id, existing);
  }
  // Fallback: courses without timetable group entries inherit university campuses
  for (const course of courses) {
    if (!courseCampusMap.has(course.id) && uniCampusMap.has(course.university_id)) {
      courseCampusMap.set(course.id, uniCampusMap.get(course.university_id)!);
    }
  }

  const activeUniversities = universities.filter((u: any) => u.is_active);
  const displayUniversities = showInactive ? universities : activeUniversities;

  const uniMap = new Map(universities.map((u: any) => [u.id, u.name]));

  // Auto-select "all" or keep selection
  const effectiveUniId =
    selectedUniId === "all"
      ? "all"
      : selectedUniId && displayUniversities.some((u: any) => u.id === selectedUniId)
        ? selectedUniId
        : "all";

  const filteredCourses = courses.filter((c: any) => {
    if (effectiveUniId !== "all" && c.university_id !== effectiveUniId) return false;
    if (!showInactive && c.is_active === false) return false;
    if (search) {
      const term = search.toLowerCase();
      const uniName = (uniMap.get(c.university_id) || "").toLowerCase();
      const campusLocations = courseCampusMap.get(c.id) || [];
      const campusMatch = campusLocations.some(
        (loc) =>
          loc.name.toLowerCase().includes(term) ||
          loc.city?.toLowerCase().includes(term)
      );
      return (
        c.name.toLowerCase().includes(term) ||
        uniName.includes(term) ||
        c.level?.toLowerCase().includes(term) ||
        c.study_mode?.toLowerCase().includes(term) ||
        c.duration?.toLowerCase().includes(term) ||
        campusMatch
      );
    }
    return true;
  });

  const getIntakeLabels = (uniId: string) =>
    intakes
      .filter((i: any) => i.university_id === uniId)
      .map((i: any) => i.label);

  const currentRole = role || "agent";

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Universities & Courses
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse available courses and start an application.
          </p>
        </div>

        {/* University tabs */}
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            <button
              onClick={() => setSelectedUniId("all")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors ${
                effectiveUniId === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              <GraduationCap className="h-4 w-4 shrink-0" />
              All
              <Badge
                variant={effectiveUniId === "all" ? "secondary" : "outline"}
                className="text-[10px] ml-1"
              >
                {courses.filter((c: any) => showInactive || c.is_active !== false).length}
              </Badge>
            </button>
            {displayUniversities.map((uni: any) => {
              const courseCount = courses.filter(
                (c: any) => c.university_id === uni.id && (showInactive || c.is_active !== false)
              ).length;
              return (
                <button
                  key={uni.id}
                  onClick={() => setSelectedUniId(uni.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors ${
                    effectiveUniId === uni.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  {uni.name}
                  {!uni.is_active && (
                    <Badge variant="secondary" className="text-[9px] px-1">Inactive</Badge>
                  )}
                  <Badge
                    variant={effectiveUniId === uni.id ? "secondary" : "outline"}
                    className="text-[10px] ml-1"
                  >
                    {courseCount}
                  </Badge>
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {(role === "owner" || role === "admin") && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
                Show inactive
              </Label>
            </div>
          )}
           {(role === "owner" || role === "admin") && effectiveUniId && effectiveUniId !== "all" && (() => {
            const uni = displayUniversities.find((u: any) => u.id === effectiveUniId);
            const uniName = uni?.name || "";
            const hasUrl = !!getUniversityUrl(uniName);
            if (!hasUrl) return null;
            return (
              <Button
                variant="outline"
                size="sm"
                disabled={scanningUniId === effectiveUniId}
                onClick={() => handleScanDetails(effectiveUniId, uniName)}
              >
                {scanningUniId === effectiveUniId ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Scanning...</>
                ) : (
                  <><ScanSearch className="h-4 w-4 mr-1" /> Scan Details</>
                )}
              </Button>
            );
          })()}
        </div>

        {/* Summary */}
        <p className="text-sm text-muted-foreground">
          {filteredCourses.length} course{filteredCourses.length !== 1 ? "s" : ""} available
        </p>

        {/* Course grid */}
        {filteredCourses.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No courses found.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.map((course: any) => {
              const uniIntakes = getIntakeLabels(course.university_id);
              return (
                <Card
                  key={course.id}
                  className="bg-slate-800 border-slate-700 text-white overflow-hidden hover:border-primary/50 transition-colors"
                >
                  <CardContent className="p-5 flex flex-col gap-3 h-full">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-base leading-tight">
                            {course.name}
                          </h3>
                          {effectiveUniId === "all" && (
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {uniMap.get(course.university_id) || "Unknown"}
                            </p>
                          )}
                        </div>
                        {course.is_active === false && (
                          <Badge variant="secondary" className="text-[9px] shrink-0">
                            Inactive
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize border-slate-500 text-slate-300"
                        >
                          {course.level}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize border-slate-500 text-slate-300"
                        >
                          {course.study_mode}
                        </Badge>
                      </div>

                      <div className="space-y-1.5 text-sm text-slate-300">
                        {course.duration && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{course.duration}</span>
                          </div>
                        )}
                        {uniIntakes.length > 0 && (
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span className="truncate">
                              {uniIntakes.slice(0, 3).join(", ")}
                              {uniIntakes.length > 3 && ` +${uniIntakes.length - 3}`}
                            </span>
                          </div>
                        )}
                        {(() => {
                          const locs = courseCampusMap.get(course.id) || [];
                          if (locs.length === 0) return null;
                          return (
                            <div className="flex gap-2">
                              <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                              <ul className="space-y-0.5">
                                {locs.map((l, i) => (
                                  <li key={i} className="text-sm text-muted-foreground">
                                    • {l.city ? `${l.name} (${l.city})` : l.name}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })()}
                        {course.fees && (
                          <div className="flex items-center gap-2">
                            <PoundSterling className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{course.fees}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 border-slate-500 text-slate-300 hover:bg-slate-700 hover:text-white"
                        onClick={() => setDetailsCourseId(detailsCourseId === course.id ? null : course.id)}
                      >
                        {detailsCourseId === course.id ? "Hide" : "Details"}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
                        onClick={() =>
                          navigate(
                            `/${currentRole}/enroll?university=${course.university_id}&course=${course.id}`
                          )
                        }
                      >
                        Apply <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>

                    <div
                      className={`grid transition-all duration-300 ease-in-out ${
                        detailsCourseId === course.id
                          ? "grid-rows-[1fr] opacity-100 pt-3 border-t border-slate-600 mt-3"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        {detailsCourseId === course.id && (
                          <CourseDetailsInfoCard courseId={course.id} compact />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
