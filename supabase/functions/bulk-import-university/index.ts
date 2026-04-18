import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate user and check owner role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check owner role
    const { data: roleData } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'owner' });
    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Owner access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { university_name, courses } = await req.json();
    if (!university_name || !courses?.length) {
      return new Response(
        JSON.stringify({ success: false, error: 'university_name and courses are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Upsert university
    let { data: uni } = await supabase
      .from('universities')
      .select('id')
      .ilike('name', university_name)
      .maybeSingle();

    if (!uni) {
      const { data: newUni, error } = await supabase
        .from('universities')
        .insert({ name: university_name })
        .select('id')
        .single();
      if (error) throw new Error(`Failed to create university: ${error.message}`);
      uni = newUni;
    }

    const universityId = uni!.id;

    // 2. Collect all unique campuses and upsert
    const allLocations = new Set<string>();
    for (const c of courses) {
      (c.campus_locations || []).forEach((loc: string) => allLocations.add(loc.trim()));
    }

    const campusMap: Record<string, string> = {};
    for (const loc of allLocations) {
      if (!loc) continue;
      let { data: campus } = await supabase
        .from('campuses')
        .select('id')
        .eq('university_id', universityId)
        .ilike('name', loc)
        .maybeSingle();

      if (!campus) {
        const { data: newCampus, error } = await supabase
          .from('campuses')
          .insert({ university_id: universityId, name: loc, city: loc })
          .select('id')
          .single();
        if (error) {
          console.error(`Campus insert error for ${loc}:`, error);
          continue;
        }
        campus = newCampus;
      }
      campusMap[loc] = campus!.id;
    }

    // 3. Insert courses (skip duplicates by name)
    let coursesInserted = 0;
    let coursesSkipped = 0;
    const courseDetails: any[] = [];

    for (const c of courses) {
      const { data: existing } = await supabase
        .from('courses')
        .select('id')
        .eq('university_id', universityId)
        .ilike('name', c.name)
        .maybeSingle();

      if (existing) {
        coursesSkipped++;
        continue;
      }

      // Map level
      let level = 'undergraduate';
      const lvl = (c.level || '').toLowerCase();
      if (lvl.includes('postgrad') || lvl.includes('master') || lvl.includes('mba') || lvl.includes('msc')) level = 'postgraduate';
      else if (lvl.includes('foundation')) level = 'foundation';

      // Map study mode
      let study_mode = 'blended';
      const sm = (c.study_mode || '').toLowerCase();
      if (sm.includes('full-time') || sm.includes('full time')) study_mode = 'full-time';
      else if (sm.includes('part-time') || sm.includes('part time')) study_mode = 'part-time';
      else if (sm.includes('online')) study_mode = 'online';

      const { error } = await supabase.from('courses').insert({
        university_id: universityId,
        name: c.name,
        level,
        study_mode,
      });

      if (error) {
        console.error(`Course insert error for ${c.name}:`, error);
        continue;
      }

      coursesInserted++;
      courseDetails.push(c);
    }

    // 4. Create Knowledge Base entries
    let kbInserted = 0;

    // Overview entry
    const overviewContent = [
      `University: ${university_name}`,
      `Campuses: ${[...allLocations].join(', ') || 'N/A'}`,
      `Total Courses Found: ${courses.length}`,
      '',
      'Courses:',
      ...courses.map((c: any) => `- ${c.name} (${c.level || 'N/A'}, ${c.study_mode || 'N/A'})`),
    ].join('\n');

    const { error: kbOverviewErr } = await supabase.from('ai_knowledge_base').insert({
      title: `${university_name} — Overview`,
      content: overviewContent,
      category: 'courses',
      created_by: user.id,
    });
    if (!kbOverviewErr) kbInserted++;

    // Per-course entries
    for (const c of courseDetails) {
      const courseContent = [
        `Course: ${c.name}`,
        `University: ${university_name}`,
        `Level: ${c.level || 'N/A'}`,
        `Study Mode: ${c.study_mode || 'N/A'}`,
        `Duration: ${c.duration || 'N/A'}`,
        `Campuses: ${(c.campus_locations || []).join(', ') || 'N/A'}`,
        '',
        'Entry Requirements:',
        c.entry_requirements || 'Not specified',
        '',
        'Description:',
        c.description || 'Not available',
      ].join('\n');

      const { error: kbErr } = await supabase.from('ai_knowledge_base').insert({
        title: `${university_name} — ${c.name}`,
        content: courseContent,
        category: 'courses',
        created_by: user.id,
      });
      if (!kbErr) kbInserted++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          university: university_name,
          universityId,
          campusesCreated: Object.keys(campusMap).length,
          coursesInserted,
          coursesSkipped,
          knowledgeBaseEntries: kbInserted,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
