function repairJSON(str) {
  const match = str.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found");
  let json = match[0];
  json = json
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/:\s*'([^']*)'/g, ': "$1"')
    .replace(/([^\\])\\([^"\\\/bfnrtu])/g, '$1$2');
  return json;
}

async function groq(messages, maxTokens = 4096, temp = 0.2) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      temperature: temp,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}

async function apifyRun(actorId, input, maxWaitMs = 60000) {
  try {
    if (!process.env.APIFY_API_KEY) return null;
    const runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.APIFY_API_KEY}`,
      },
      body: JSON.stringify(input),
    });
    if (!runRes.ok) return null;
    const runData = await runRes.json();
    const runId = runData.data?.id;
    if (!runId) return null;

    const polls = Math.floor(maxWaitMs / 5000);
    for (let i = 0; i < polls; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
        headers: { 'Authorization': `Bearer ${process.env.APIFY_API_KEY}` },
      });
      const statusData = await statusRes.json();
      const status = statusData.data?.status;
      if (status === 'SUCCEEDED') {
        const datasetId = statusData.data.defaultDatasetId;
        const resultsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?limit=20`, {
          headers: { 'Authorization': `Bearer ${process.env.APIFY_API_KEY}` },
        });
        const items = await resultsRes.json();
        return Array.isArray(items) && items.length > 0 ? items : null;
      }
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) return null;
    }
    return null;
  } catch (e) {
    console.error(`Apify error ${actorId}:`, e.message);
    return null;
  }
}

async function getHunterEmails(domain) {
  try {
    if (!process.env.HUNTER_API_KEY) return [];
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&limit=3&api_key=${process.env.HUNTER_API_KEY}`);
    const data = await res.json();
    if (!data.data?.emails?.length) return [];
    return data.data.emails.slice(0, 3).map(e => ({
      name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
      title: e.position || 'Unknown',
      email: e.value,
      score: ['ceo', 'owner', 'director', 'founder', 'cmo', 'head', 'vp'].some(t => e.position?.toLowerCase().includes(t)) ? 9 : 6,
    }));
  } catch (e) {
    return [];
  }
}

export async function POST(request) {
  try {
    const { prompt } = await request.json();
    if (!prompt) return Response.json({ error: "Prompt is required" }, { status: 400 });

    // Step 1: Parse the prompt to extract search intent
    const parseResult = await groq([
      {
        role: "system",
        content: "You parse lead generation prompts and return ONLY valid JSON. No markdown, no backticks.",
      },
      {
        role: "user",
        content: `Parse this lead generation request: "${prompt}"

Return JSON:
{
  "industry": "specific industry",
  "location": "city/country or null",
  "criteria": "what makes them a qualified lead",
  "platforms_to_check": ["meta", "google", "linkedin"],
  "search_queries": ["google search query 1", "google search query 2"],
  "meta_search_terms": ["keyword1", "keyword2"],
  "estimated_lead_type": "local/ecommerce/b2b/saas/service",
  "budget_signal": "what ad spend signals they have budget"
}`,
      },
    ], 512, 0.1);

    let searchIntent;
    try {
      searchIntent = JSON.parse(repairJSON(parseResult));
    } catch (e) {
      searchIntent = {
        industry: prompt,
        location: null,
        meta_search_terms: [prompt],
        search_queries: [prompt + " company website"],
      };
    }

    // Step 2: Run searches in parallel
    const searches = [];

    // Meta ads search for each term
    if (searchIntent.meta_search_terms?.length > 0) {
      const metaUrls = searchIntent.meta_search_terms.slice(0, 2).map(term => ({
        url: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(term + (searchIntent.location ? ' ' + searchIntent.location : ''))}&search_type=keyword_unordered`,
      }));
      searches.push(
        apifyRun('apify~facebook-ads-scraper', {
          startUrls: metaUrls,
          maxAds: 20,
          activeStatus: 'ACTIVE',
        }, 60000)
      );
    } else {
      searches.push(Promise.resolve(null));
    }

    // Google search for companies matching criteria
    if (searchIntent.search_queries?.length > 0) {
      const googleUrls = searchIntent.search_queries.slice(0, 2).map(q => ({
        url: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
      }));
      searches.push(
        apifyRun('apify~google-search-scraper', {
          queries: searchIntent.search_queries.slice(0, 2).map(q =>
            searchIntent.location ? `${q} ${searchIntent.location}` : q
          ).join('\n'),
          maxPagesPerQuery: 1,
          resultsPerPage: 10,
        }, 45000)
      );
    } else {
      searches.push(Promise.resolve(null));
    }

    // LinkedIn company search
    searches.push(
      apifyRun('apimaestro~linkedin-company-scraper', {
        searchQuery: `${searchIntent.industry} ${searchIntent.location || ''}`.trim(),
        maxResults: 10,
      }, 45000)
    );

    const [metaResults, googleResults, linkedinResults] = await Promise.all(searches);

    // Step 3: AI generates leads from all data combined
    const rawData = {
      meta_ads: metaResults?.slice(0, 15) || [],
      google_results: googleResults?.slice(0, 10) || [],
      linkedin_companies: linkedinResults?.slice(0, 10) || [],
    };

    const leadsResult = await groq([
      {
        role: "system",
        content: "You are a lead qualification expert. Return ONLY valid JSON. No markdown, no backticks. Start with {",
      },
      {
        role: "user",
        content: `Based on this search data and the original request "${prompt}", generate a list of qualified leads.

RAW DATA FOUND:
${JSON.stringify(rawData, null, 2).slice(0, 8000)}

Return JSON with real companies found in the data above, plus any additional companies you know match the criteria:

{
  "total_found": 10,
  "search_summary": "What was found and why these are good leads",
  "leads": [
    {
      "company_name": "Real Company Name",
      "domain": "company.com",
      "industry": "specific industry",
      "location": "city, country",
      "signal_score": 75,
      "hot_lead": true,
      "why_qualified": "Specific reason this is a good lead based on the criteria",
      "ad_activity": {
        "meta": {"active": true, "ad_count": "5-10", "spend_estimate": "$500-2k/mo"},
        "google": {"active": false},
        "linkedin": {"active": false}
      },
      "pain_points": ["specific pain point 1", "specific pain point 2"],
      "best_angle": "Specific outreach angle for this company",
      "dm_opener": "Ready to send personalised DM",
      "contacts": []
    }
  ]
}`,
      },
    ], 4096, 0.3);

    let leadsData;
    try {
      leadsData = JSON.parse(repairJSON(leadsResult));
    } catch (e) {
      throw new Error(`Failed to parse leads: ${e.message}`);
    }

    // Step 4: Enrich with real emails from Hunter for top leads
    if (leadsData.leads?.length > 0) {
      const enrichPromises = leadsData.leads.slice(0, 5).map(async (lead, i) => {
        if (lead.domain) {
          const emails = await getHunterEmails(lead.domain);
          if (emails.length > 0) {
            leadsData.leads[i].contacts = emails;
          }
        }
      });
      await Promise.all(enrichPromises);
    }

    leadsData.prompt = prompt;
    leadsData.search_intent = searchIntent;
    leadsData.data_sources = {
      meta_ads_found: metaResults?.length || 0,
      google_results_found: googleResults?.length || 0,
      linkedin_found: linkedinResults?.length || 0,
    };

    return Response.json(leadsData);
  } catch (error) {
    console.error("Leads API error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}