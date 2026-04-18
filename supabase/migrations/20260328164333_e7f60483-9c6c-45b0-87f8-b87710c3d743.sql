
-- Consolidate QA campuses: keep "Birmingham", "London", "Manchester" (simplest names)
-- University: 51caa70d-82a2-4aaa-b6e5-2417b8a89cf4

-- Keep IDs:
-- Birmingham: 10dc519c-3f89-41d7-abdd-0bcf6da1ca0f
-- London:     fae0ad22-b3ef-41af-a3a2-3881482cfe72
-- Manchester: f49dcc9f-c153-40b6-8104-819917ee302b

-- Merge "Birmingham Campus" + "Campus Birmingham" -> "Birmingham"
UPDATE public.course_timetable_groups SET campus_id = '10dc519c-3f89-41d7-abdd-0bcf6da1ca0f'
WHERE campus_id IN ('93f319fe-810a-46b0-85eb-8fbc8f73385f', 'f6aa63d3-5d5d-4ffe-a711-acb2b8cf16ec');

UPDATE public.enrollments SET campus_id = '10dc519c-3f89-41d7-abdd-0bcf6da1ca0f'
WHERE campus_id IN ('93f319fe-810a-46b0-85eb-8fbc8f73385f', 'f6aa63d3-5d5d-4ffe-a711-acb2b8cf16ec');

UPDATE public.leads SET campus_id = '10dc519c-3f89-41d7-abdd-0bcf6da1ca0f'
WHERE campus_id IN ('93f319fe-810a-46b0-85eb-8fbc8f73385f', 'f6aa63d3-5d5d-4ffe-a711-acb2b8cf16ec');

DELETE FROM public.campuses WHERE id IN ('93f319fe-810a-46b0-85eb-8fbc8f73385f', 'f6aa63d3-5d5d-4ffe-a711-acb2b8cf16ec');

-- Merge "London Campus" + "Campus London" -> "London"
UPDATE public.course_timetable_groups SET campus_id = 'fae0ad22-b3ef-41af-a3a2-3881482cfe72'
WHERE campus_id IN ('50c76727-d51b-4db5-b5ad-2fb3f708d910', '5b96c53d-56e4-4410-9535-02ae2f9e4381');

UPDATE public.enrollments SET campus_id = 'fae0ad22-b3ef-41af-a3a2-3881482cfe72'
WHERE campus_id IN ('50c76727-d51b-4db5-b5ad-2fb3f708d910', '5b96c53d-56e4-4410-9535-02ae2f9e4381');

UPDATE public.leads SET campus_id = 'fae0ad22-b3ef-41af-a3a2-3881482cfe72'
WHERE campus_id IN ('50c76727-d51b-4db5-b5ad-2fb3f708d910', '5b96c53d-56e4-4410-9535-02ae2f9e4381');

DELETE FROM public.campuses WHERE id IN ('50c76727-d51b-4db5-b5ad-2fb3f708d910', '5b96c53d-56e4-4410-9535-02ae2f9e4381');

-- Merge "Campus Manchester" -> "Manchester"
UPDATE public.course_timetable_groups SET campus_id = 'f49dcc9f-c153-40b6-8104-819917ee302b'
WHERE campus_id = '8c6e6266-0734-4378-b795-5359b2791183';

UPDATE public.enrollments SET campus_id = 'f49dcc9f-c153-40b6-8104-819917ee302b'
WHERE campus_id = '8c6e6266-0734-4378-b795-5359b2791183';

UPDATE public.leads SET campus_id = 'f49dcc9f-c153-40b6-8104-819917ee302b'
WHERE campus_id = '8c6e6266-0734-4378-b795-5359b2791183';

DELETE FROM public.campuses WHERE id = '8c6e6266-0734-4378-b795-5359b2791183';

-- Deduplicate course_timetable_groups that now have same course+campus+timetable combo
DELETE FROM public.course_timetable_groups
WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
  AND id NOT IN (
    SELECT DISTINCT ON (course_id, COALESCE(campus_id, '00000000-0000-0000-0000-000000000000'), timetable_option_id) id
    FROM public.course_timetable_groups
    WHERE university_id = '51caa70d-82a2-4aaa-b6e5-2417b8a89cf4'
    ORDER BY course_id, COALESCE(campus_id, '00000000-0000-0000-0000-000000000000'), timetable_option_id, created_at ASC
  );
