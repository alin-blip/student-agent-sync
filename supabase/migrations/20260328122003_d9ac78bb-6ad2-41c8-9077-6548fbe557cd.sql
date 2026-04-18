-- Delete all course_timetable_groups for non-GBS universities
DELETE FROM public.course_timetable_groups WHERE university_id != 'a88ca2ff-ed12-4fa3-8191-625e03620556';

-- Delete all course_details for non-GBS courses
DELETE FROM public.course_details WHERE course_id IN (
  SELECT id FROM public.courses WHERE university_id != 'a88ca2ff-ed12-4fa3-8191-625e03620556'
);

-- Delete all timetable_options for non-GBS universities
DELETE FROM public.timetable_options WHERE university_id != 'a88ca2ff-ed12-4fa3-8191-625e03620556';

-- Delete all intakes for non-GBS universities
DELETE FROM public.intakes WHERE university_id != 'a88ca2ff-ed12-4fa3-8191-625e03620556';

-- Delete all courses for non-GBS universities
DELETE FROM public.courses WHERE university_id != 'a88ca2ff-ed12-4fa3-8191-625e03620556';

-- Delete all campuses for non-GBS universities
DELETE FROM public.campuses WHERE university_id != 'a88ca2ff-ed12-4fa3-8191-625e03620556';

-- Delete non-GBS universities
DELETE FROM public.universities WHERE id != 'a88ca2ff-ed12-4fa3-8191-625e03620556';

-- Clean AI knowledge base entries for non-GBS data
DELETE FROM public.ai_knowledge_base WHERE category = 'courses' AND content NOT ILIKE '%Global Banking School%';