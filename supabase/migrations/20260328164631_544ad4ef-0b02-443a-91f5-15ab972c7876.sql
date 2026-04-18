
-- Delete all QA university data
-- University ID: 51caa70d-82a2-4aaa-b6e5-2417b8a89cf4

-- 1. Delete course_timetable_groups
DELETE FROM public.course_timetable_groups WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4';

-- 2. Delete course_details (linked via courses)
DELETE FROM public.course_details WHERE course_id IN (
  SELECT id FROM public.courses WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
);

-- 3. Delete timetable_options
DELETE FROM public.timetable_options WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4';

-- 4. Delete intakes
DELETE FROM public.intakes WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4';

-- 5. Delete courses
DELETE FROM public.courses WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4';

-- 6. Delete campuses
DELETE FROM public.campuses WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4';

-- 7. Delete knowledge base entries for QA
DELETE FROM public.ai_knowledge_base WHERE title ILIKE '%QA%';

-- 8. Delete the university itself
DELETE FROM public.universities WHERE id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4';
