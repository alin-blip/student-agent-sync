
-- ============================================
-- CLEAN QA UNIVERSITY DUPLICATES
-- University ID: 51caa70d-82a2-4aaa-b6e5-2417b8a89cf4
-- ============================================

-- STEP 1: Fix campus duplicates
-- First, reassign course_timetable_groups to kept campus (oldest by created_at per name)
WITH kept AS (
  SELECT DISTINCT ON (name) id, name
  FROM public.campuses
  WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  ORDER BY name, created_at ASC
),
dupes AS (
  SELECT c.id AS dupe_id, k.id AS keep_id
  FROM public.campuses c
  JOIN kept k ON c.name = k.name
  WHERE c.university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    AND c.id != k.id
)
UPDATE public.course_timetable_groups ctg
SET campus_id = d.keep_id
FROM dupes d
WHERE ctg.campus_id = d.dupe_id;

-- Reassign enrollments campus_id
WITH kept AS (
  SELECT DISTINCT ON (name) id, name
  FROM public.campuses
  WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  ORDER BY name, created_at ASC
),
dupes AS (
  SELECT c.id AS dupe_id, k.id AS keep_id
  FROM public.campuses c
  JOIN kept k ON c.name = k.name
  WHERE c.university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    AND c.id != k.id
)
UPDATE public.enrollments e
SET campus_id = d.keep_id
FROM dupes d
WHERE e.campus_id = d.dupe_id;

-- Reassign leads campus_id
WITH kept AS (
  SELECT DISTINCT ON (name) id, name
  FROM public.campuses
  WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  ORDER BY name, created_at ASC
),
dupes AS (
  SELECT c.id AS dupe_id, k.id AS keep_id
  FROM public.campuses c
  JOIN kept k ON c.name = k.name
  WHERE c.university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    AND c.id != k.id
)
UPDATE public.leads l
SET campus_id = d.keep_id
FROM dupes d
WHERE l.campus_id = d.dupe_id;

-- Delete duplicate campuses
DELETE FROM public.campuses
WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  AND id NOT IN (
    SELECT DISTINCT ON (name) id
    FROM public.campuses
    WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    ORDER BY name, created_at ASC
  );

-- STEP 2: Fix course duplicates
-- Reassign course_details to kept course
WITH kept AS (
  SELECT DISTINCT ON (name) id, name
  FROM public.courses
  WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  ORDER BY name, created_at ASC
),
dupes AS (
  SELECT c.id AS dupe_id, k.id AS keep_id
  FROM public.courses c
  JOIN kept k ON c.name = k.name
  WHERE c.university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    AND c.id != k.id
)
-- Delete duplicate course_details first (keep only the one on the kept course)
DELETE FROM public.course_details
WHERE course_id IN (SELECT dupe_id FROM dupes);

-- Reassign course_timetable_groups to kept course
WITH kept AS (
  SELECT DISTINCT ON (name) id, name
  FROM public.courses
  WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  ORDER BY name, created_at ASC
),
dupes AS (
  SELECT c.id AS dupe_id, k.id AS keep_id
  FROM public.courses c
  JOIN kept k ON c.name = k.name
  WHERE c.university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    AND c.id != k.id
)
UPDATE public.course_timetable_groups ctg
SET course_id = d.keep_id
FROM dupes d
WHERE ctg.course_id = d.dupe_id;

-- Reassign enrollments course_id
WITH kept AS (
  SELECT DISTINCT ON (name) id, name
  FROM public.courses
  WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  ORDER BY name, created_at ASC
),
dupes AS (
  SELECT c.id AS dupe_id, k.id AS keep_id
  FROM public.courses c
  JOIN kept k ON c.name = k.name
  WHERE c.university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    AND c.id != k.id
)
UPDATE public.enrollments e
SET course_id = d.keep_id
FROM dupes d
WHERE e.course_id = d.dupe_id;

-- Reassign leads course_id
WITH kept AS (
  SELECT DISTINCT ON (name) id, name
  FROM public.courses
  WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  ORDER BY name, created_at ASC
),
dupes AS (
  SELECT c.id AS dupe_id, k.id AS keep_id
  FROM public.courses c
  JOIN kept k ON c.name = k.name
  WHERE c.university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    AND c.id != k.id
)
UPDATE public.leads l
SET course_id = d.keep_id
FROM dupes d
WHERE l.course_id = d.dupe_id;

-- Delete duplicate courses
DELETE FROM public.courses
WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  AND id NOT IN (
    SELECT DISTINCT ON (name) id
    FROM public.courses
    WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    ORDER BY name, created_at ASC
  );

-- STEP 3: Fix timetable_options duplicates
-- Reassign course_timetable_groups to kept timetable option
WITH kept AS (
  SELECT DISTINCT ON (label) id, label
  FROM public.timetable_options
  WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  ORDER BY label, created_at ASC
),
dupes AS (
  SELECT t.id AS dupe_id, k.id AS keep_id
  FROM public.timetable_options t
  JOIN kept k ON t.label = k.label
  WHERE t.university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    AND t.id != k.id
)
UPDATE public.course_timetable_groups ctg
SET timetable_option_id = d.keep_id
FROM dupes d
WHERE ctg.timetable_option_id = d.dupe_id;

-- Delete duplicate timetable options
DELETE FROM public.timetable_options
WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  AND id NOT IN (
    SELECT DISTINCT ON (label) id
    FROM public.timetable_options
    WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    ORDER BY label, created_at ASC
  );

-- STEP 4: Fix intakes duplicates
-- Reassign enrollments intake_id
WITH kept AS (
  SELECT DISTINCT ON (label, start_date) id, label, start_date
  FROM public.intakes
  WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  ORDER BY label, start_date, created_at ASC
),
dupes AS (
  SELECT i.id AS dupe_id, k.id AS keep_id
  FROM public.intakes i
  JOIN kept k ON i.label = k.label AND i.start_date = k.start_date
  WHERE i.university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    AND i.id != k.id
)
UPDATE public.enrollments e
SET intake_id = d.keep_id
FROM dupes d
WHERE e.intake_id = d.dupe_id;

-- Reassign leads intake_id
WITH kept AS (
  SELECT DISTINCT ON (label, start_date) id, label, start_date
  FROM public.intakes
  WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  ORDER BY label, start_date, created_at ASC
),
dupes AS (
  SELECT i.id AS dupe_id, k.id AS keep_id
  FROM public.intakes i
  JOIN kept k ON i.label = k.label AND i.start_date = k.start_date
  WHERE i.university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    AND i.id != k.id
)
UPDATE public.leads l
SET intake_id = d.keep_id
FROM dupes d
WHERE l.intake_id = d.dupe_id;

-- Delete duplicate intakes
DELETE FROM public.intakes
WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  AND id NOT IN (
    SELECT DISTINCT ON (label, start_date) id
    FROM public.intakes
    WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    ORDER BY label, start_date, created_at ASC
  );

-- STEP 5: Remove duplicate course_timetable_groups (same course+campus+timetable combo)
DELETE FROM public.course_timetable_groups
WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  AND id NOT IN (
    SELECT DISTINCT ON (course_id, COALESCE(campus_id, '00000000-0000-0000-0000-000000000000'), timetable_option_id) id
    FROM public.course_timetable_groups
    WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    ORDER BY course_id, COALESCE(campus_id, '00000000-0000-0000-0000-000000000000'), timetable_option_id, created_at ASC
  );

-- STEP 6: Remove duplicate knowledge base entries for QA
DELETE FROM public.ai_knowledge_base
WHERE id NOT IN (
  SELECT DISTINCT ON (title, category) id
  FROM public.ai_knowledge_base
  WHERE title ILIKE '%QA%' OR content ILIKE '%QA %Ulster%'
  ORDER BY title, category, created_at ASC
)
AND (title ILIKE '%QA%' OR content ILIKE '%QA %Ulster%');
