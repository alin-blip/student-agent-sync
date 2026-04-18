const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url } = await req.json();
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http')) formattedUrl = `https://${formattedUrl}`;

    console.log('Step 1: Mapping site', formattedUrl);

    // Step 1: Map to find course URLs
    const mapRes = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: formattedUrl, search: 'courses programmes programs study', limit: 200, includeSubdomains: false }),
    });
    const mapData = await mapRes.json();
    if (!mapRes.ok) {
      console.error('Map error:', JSON.stringify(mapData));
      return new Response(
        JSON.stringify({ success: false, error: mapData.error || 'Failed to map site' }),
        { status: mapRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allLinks: string[] = mapData.links || [];
    console.log(`Found ${allLinks.length} total links`);

    // Filter for course-related pages (broad patterns)
    const coursePatterns = ['/courses/', '/programmes/', '/program/', '/course/', '/study/', '/undergraduate/', '/postgraduate/', '/degree/', '/hnd/', '/masters/', '/msc/', '/bsc/', '/ba-'];
    const excludePatterns = ['/category', '/search', 'page=', 'sitemap', '/tag/', '/author/', '/wp-content/', '/wp-admin/', '/feed/', '.pdf', '.jpg', '.png', '/login', '/register', '/cart', '/checkout'];
    
    const courseUrls = allLinks.filter((link: string) => {
      const lower = link.toLowerCase();
      const hasPattern = coursePatterns.some(p => lower.includes(p));
      if (!hasPattern) return false;
      // Exclude utility pages
      if (excludePatterns.some(p => lower.includes(p))) return false;
      return true;
    });

    const uniqueCourseUrls = [...new Set(courseUrls)];
    console.log(`Found ${uniqueCourseUrls.length} course-related URLs`);

    // Determine which URLs to scrape
    let urlsToScrape: string[] = [];
    
    if (uniqueCourseUrls.length > 0) {
      // Use found course URLs (up to 25)
      urlsToScrape = uniqueCourseUrls.slice(0, 25);
    } else {
      // Fallback: scrape the provided URL directly + any relevant-looking pages
      console.log('No course URLs found via patterns, falling back to direct scrape');
      urlsToScrape = [formattedUrl];
      
      // Also add pages that might be course listings (top-level pages with relevant words)
      const relevantPages = allLinks.filter((link: string) => {
        const lower = link.toLowerCase();
        if (excludePatterns.some(p => lower.includes(p))) return false;
        return /course|program|study|degree|train|learn|diploma|certificate/i.test(lower);
      });
      
      for (const p of relevantPages.slice(0, 10)) {
        if (!urlsToScrape.includes(p)) urlsToScrape.push(p);
      }
      
      // If still only the main URL, add a few top links from the sitemap
      if (urlsToScrape.length <= 1 && allLinks.length > 0) {
        for (const link of allLinks.slice(0, 10)) {
          if (!urlsToScrape.includes(link) && !excludePatterns.some(p => link.toLowerCase().includes(p))) {
            urlsToScrape.push(link);
          }
        }
        urlsToScrape = urlsToScrape.slice(0, 15);
      }
    }

    console.log(`Will scrape ${urlsToScrape.length} URLs`);

    // Step 2: Scrape pages
    const scrapedPages: { url: string; markdown: string }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < urlsToScrape.length; i += 5) {
      const batch = urlsToScrape.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (courseUrl) => {
          console.log('Scraping:', courseUrl);
          const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: courseUrl, formats: ['markdown'], onlyMainContent: true }),
          });
          const scrapeData = await scrapeRes.json();
          if (!scrapeRes.ok) {
            throw new Error(scrapeData.error || `HTTP ${scrapeRes.status}`);
          }
          const md = scrapeData.data?.markdown || scrapeData.markdown || '';
          if (!md) throw new Error('No content returned');
          return { url: courseUrl, markdown: md.slice(0, 3000) };
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') scrapedPages.push(r.value);
        else errors.push(r.reason?.message || 'Unknown error');
      }
    }

    console.log(`Scraped ${scrapedPages.length} pages successfully, ${errors.length} errors`);

    if (scrapedPages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: `All scrapes failed. Errors: ${errors.slice(0, 3).join('; ')}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Use AI to extract structured course data
    const combinedContent = scrapedPages.map((p, i) =>
      `=== PAGE ${i + 1}: ${p.url} ===\n${p.markdown}`
    ).join('\n\n');

    console.log('Step 3: Extracting course data with AI...');

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You extract course/programme information from web pages. Return ONLY a JSON array of courses found. Each course object must have:
- "name": full course name (string)
- "level": "undergraduate", "postgraduate", "foundation", or "hnd" (string)
- "study_mode": "full-time", "part-time", "blended", or "online" (string)  
- "duration": duration like "3 years" (string, empty if unknown)
- "campus_locations": array of campus city names (string[])
- "entry_requirements": brief summary (string, empty if unknown)
- "description": 1-2 sentence description (string)
- "source_url": the page URL this was extracted from (string)

If no courses or programmes are found on the pages, return an empty array [].
Return ONLY the JSON array, no markdown formatting, no explanation.`
          },
          {
            role: 'user',
            content: `Extract all courses/programmes from these web pages:\n\n${combinedContent}`
          }
        ],
        temperature: 0.1,
        max_tokens: 8000,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('AI API error:', errText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI extraction failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiRes.json();
    const aiContent = aiData.choices?.[0]?.message?.content || '';
    console.log('AI response length:', aiContent.length);

    let courses: any[] = [];
    try {
      const cleaned = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      courses = JSON.parse(cleaned);
      if (!Array.isArray(courses)) courses = [courses];
    } catch (parseErr) {
      console.error('Failed to parse AI response:', aiContent.slice(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to parse extracted course data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracted ${courses.length} courses via AI`);

    return new Response(
      JSON.stringify({
        success: true,
        courses,
        totalUrlsFound: allLinks.length,
        scraped: scrapedPages.length,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
