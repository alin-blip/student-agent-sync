import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, ArrowRight, GraduationCap, Building2, MapPin } from "lucide-react";

export function DashboardSearchCard() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { role } = useAuth();
  const currentRole = role || "agent";

  const { data: courses = [] } = useQuery({
    queryKey: ["courses-all"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const { data: universities = [] } = useQuery({
    queryKey: ["universities-all"],
    queryFn: async () => {
      const { data } = await supabase.from("universities").select("*").order("name");
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

  const uniMap = new Map(universities.map((u: any) => [u.id, u.name]));

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

  const filtered = search.trim().length < 2
    ? []
    : courses
        .filter((c: any) => {
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
        })
        .slice(0, 6);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-primary" />
          Quick Course Search
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courses, universities, campuses, cities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {filtered.length > 0 && (
          <div className="space-y-1.5">
            {filtered.map((course: any) => {
              const locs = courseCampusMap.get(course.id) || [];
              const locDisplay = locs.slice(0, 2).map((l) => l.city || l.name).join(", ");
              return (
                <div
                  key={course.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-md border bg-muted/30 hover:bg-muted/60 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{course.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">
                        {uniMap.get(course.university_id) || "Unknown"}
                      </span>
                      <Badge variant="outline" className="text-[9px] capitalize ml-1">
                        {course.level}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] capitalize">
                        {course.study_mode}
                      </Badge>
                      {locDisplay && (
                        <>
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0 ml-1" />
                          <span className="text-xs text-muted-foreground truncate">{locDisplay}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="shrink-0 h-7 text-xs"
                    onClick={() =>
                      navigate(
                        `/${currentRole}/enroll?university=${course.university_id}&course=${course.id}`
                      )
                    }
                  >
                    Apply <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              );
            })}
            <Button
              variant="link"
              size="sm"
              className="text-xs px-0"
              onClick={() => navigate(`/${currentRole}/universities?search=${encodeURIComponent(search)}`)}
            >
              View all results →
            </Button>
          </div>
        )}

        {search.trim().length >= 2 && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">No courses found</p>
        )}
      </CardContent>
    </Card>
  );
}
