
-- Remove duplicate campuses - keep one per name for CECOS
DELETE FROM public.campuses
WHERE university_id = 'd8b121c1-1b08-429b-b917-f8cc22e4981e'
AND id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM public.campuses
  WHERE university_id = 'd8b121c1-1b08-429b-b917-f8cc22e4981e'
  ORDER BY name, created_at ASC
);

-- Also clean up course_timetable_groups that reference deleted campus IDs
DELETE FROM public.course_timetable_groups
WHERE university_id = 'd8b121c1-1b08-429b-b917-f8cc22e4981e'
AND campus_id NOT IN (
  SELECT id FROM public.campuses WHERE university_id = 'd8b121c1-1b08-429b-b917-f8cc22e4981e'
);
