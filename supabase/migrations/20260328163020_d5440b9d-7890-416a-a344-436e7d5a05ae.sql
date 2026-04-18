
-- STEP 1: Reassign course_timetable_groups from duplicate courses to kept courses
WITH keep_courses AS (
  SELECT DISTINCT ON (name) id, name
  FROM courses 
  WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
  ORDER BY name, created_at ASC
),
dupe_courses AS (
  SELECT c.id as dupe_id, c.name, kc.id as keep_id
  FROM courses c
  JOIN keep_courses kc ON c.name = kc.name AND c.id != kc.id
  WHERE c.university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
)
UPDATE course_timetable_groups ctg
SET course_id = dc.keep_id
FROM dupe_courses dc
WHERE ctg.course_id = dc.dupe_id;

-- STEP 2: Remove duplicate course_timetable_groups (same course_id + campus_id + timetable_option_id)
DELETE FROM course_timetable_groups
WHERE id NOT IN (
  SELECT DISTINCT ON (course_id, campus_id, timetable_option_id) id
  FROM course_timetable_groups
  WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
  ORDER BY course_id, campus_id, timetable_option_id, created_at ASC
)
AND university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af';

-- STEP 3: Reassign course_timetable_groups from duplicate campuses to kept campuses
WITH keep_campuses AS (
  SELECT DISTINCT ON (name) id, name
  FROM campuses
  WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
  ORDER BY name, created_at ASC
),
dupe_campuses AS (
  SELECT c.id as dupe_id, c.name, kc.id as keep_id
  FROM campuses c
  JOIN keep_campuses kc ON c.name = kc.name AND c.id != kc.id
  WHERE c.university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
)
UPDATE course_timetable_groups ctg
SET campus_id = dc.keep_id
FROM dupe_campuses dc
WHERE ctg.campus_id = dc.dupe_id;

-- Remove duplicate ctg after campus reassignment
DELETE FROM course_timetable_groups
WHERE id NOT IN (
  SELECT DISTINCT ON (course_id, campus_id, timetable_option_id) id
  FROM course_timetable_groups
  WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
  ORDER BY course_id, campus_id, timetable_option_id, created_at ASC
)
AND university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af';

-- STEP 4: Reassign course_details from duplicate courses to kept courses (keep newest content)
WITH keep_courses AS (
  SELECT DISTINCT ON (name) id, name
  FROM courses
  WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
  ORDER BY name, created_at ASC
),
dupe_course_details AS (
  SELECT cd.id as cd_id, cd.course_id, c.name, kc.id as keep_id
  FROM course_details cd
  JOIN courses c ON cd.course_id = c.id
  JOIN keep_courses kc ON c.name = kc.name AND c.id != kc.id
  WHERE c.university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
)
DELETE FROM course_details WHERE id IN (
  SELECT cd_id FROM dupe_course_details
  WHERE keep_id IN (SELECT course_id FROM course_details)
);

-- Now reassign remaining orphaned course_details
WITH keep_courses AS (
  SELECT DISTINCT ON (name) id, name
  FROM courses
  WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
  ORDER BY name, created_at ASC
),
dupe_courses AS (
  SELECT c.id as dupe_id, c.name, kc.id as keep_id
  FROM courses c
  JOIN keep_courses kc ON c.name = kc.name AND c.id != kc.id
  WHERE c.university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
)
UPDATE course_details cd
SET course_id = dc.keep_id
FROM dupe_courses dc
WHERE cd.course_id = dc.dupe_id;

-- STEP 5: Delete duplicate courses (keep oldest per name)
DELETE FROM courses
WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
AND id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM courses
  WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
  ORDER BY name, created_at ASC
);

-- STEP 6: Delete duplicate campuses (keep oldest per name)
DELETE FROM campuses
WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
AND id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM campuses
  WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
  ORDER BY name, created_at ASC
);

-- STEP 7: Delete duplicate timetable_options (keep oldest per label)
WITH keep_tt AS (
  SELECT DISTINCT ON (label) id
  FROM timetable_options
  WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
  ORDER BY label, created_at ASC
),
dupe_tt AS (
  SELECT t.id as dupe_id, t.label, kt.id as keep_id
  FROM timetable_options t
  JOIN keep_tt kt ON t.id != kt.id
  WHERE t.university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
  AND t.id NOT IN (SELECT id FROM keep_tt)
  AND t.label IN (SELECT label FROM timetable_options WHERE id IN (SELECT id FROM keep_tt))
)
UPDATE course_timetable_groups ctg
SET timetable_option_id = dt.keep_id
FROM dupe_tt dt
WHERE ctg.timetable_option_id = dt.dupe_id;

DELETE FROM course_timetable_groups
WHERE id NOT IN (
  SELECT DISTINCT ON (course_id, campus_id, timetable_option_id) id
  FROM course_timetable_groups
  WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
  ORDER BY course_id, campus_id, timetable_option_id, created_at ASC
)
AND university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af';

DELETE FROM timetable_options
WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
AND id NOT IN (
  SELECT DISTINCT ON (label) id
  FROM timetable_options
  WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
  ORDER BY label, created_at ASC
);

-- STEP 8: Delete duplicate intakes (keep oldest per label+start_date)
DELETE FROM intakes
WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
AND id NOT IN (
  SELECT DISTINCT ON (label, start_date) id
  FROM intakes
  WHERE university_id = '46b1ee8a-1371-42f1-854a-f2ff7f84c8af'
  ORDER BY label, start_date, created_at ASC
);
