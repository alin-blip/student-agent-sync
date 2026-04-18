
-- Step 1: Remove duplicate campuses for CECOS (keep the first one by created_at for each name)
DELETE FROM public.campuses a
USING public.campuses b
WHERE a.university_id = 'd8b121c1-1b08-429b-b917-f8cc22e4981e'
  AND b.university_id = 'd8b121c1-1b08-429b-b917-f8cc22e4981e'
  AND a.name = b.name
  AND a.created_at > b.created_at;

-- Step 2: Map generic timetable options (Standard/Non-standard) to ALL courses at ALL campuses
INSERT INTO public.course_timetable_groups (course_id, timetable_option_id, university_id, campus_id)
SELECT c.id, t.id, 'd8b121c1-1b08-429b-b917-f8cc22e4981e', ca.id
FROM public.courses c
CROSS JOIN public.timetable_options t
CROSS JOIN public.campuses ca
WHERE c.university_id = 'd8b121c1-1b08-429b-b917-f8cc22e4981e'
  AND t.university_id = 'd8b121c1-1b08-429b-b917-f8cc22e4981e'
  AND ca.university_id = 'd8b121c1-1b08-429b-b917-f8cc22e4981e'
  AND (t.label LIKE 'Standard route%' OR t.label LIKE 'Non-standard route%');

-- Step 3: Map course-specific timetable options for "Foundation Degree in Business Management"
INSERT INTO public.course_timetable_groups (course_id, timetable_option_id, university_id, campus_id)
SELECT '75a44c79-fcb6-4099-b529-1c03baacf316', t.id, 'd8b121c1-1b08-429b-b917-f8cc22e4981e', ca.id
FROM public.timetable_options t
CROSS JOIN public.campuses ca
WHERE t.university_id = 'd8b121c1-1b08-429b-b917-f8cc22e4981e'
  AND ca.university_id = 'd8b121c1-1b08-429b-b917-f8cc22e4981e'
  AND t.label LIKE 'Foundation Degree in Business Management%';

-- Step 4: Map course-specific timetable options for "Human Resource Management" (FdA HRM)
INSERT INTO public.course_timetable_groups (course_id, timetable_option_id, university_id, campus_id)
SELECT 'd143a0fe-f6e2-411c-a6a4-5fb4201049d0', t.id, 'd8b121c1-1b08-429b-b917-f8cc22e4981e', ca.id
FROM public.timetable_options t
CROSS JOIN public.campuses ca
WHERE t.university_id = 'd8b121c1-1b08-429b-b917-f8cc22e4981e'
  AND ca.university_id = 'd8b121c1-1b08-429b-b917-f8cc22e4981e'
  AND t.label LIKE 'FdA Human Resource Management%';
