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

async function groq(messages, maxTokens = 2048, temp = 0.2) {
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

async function parsePrompt(prompt) {
  const result = await groq([
    {
      role: "system",
      content: "Parse lead generation prompts into search parameters. Return ONLY valid JSON. No markdown.",
    },
    {
      role: "user",
      content: `Parse this lead search request: "${prompt}"

Return JSON:
{
  "keywords": ["keyword1", "keyword2"],
  "industry": "specific industry name e.g. health wellness fitness / restaurants food / real estate / automotive",
  "city": "city name only e.g. Dubai",
  "country": "country name only e.g. United Arab Emirates",
  "company_size_max": 500,
  "job_titles": ["CEO", "Owner", "Marketing Manager"],
  "signal": "what makes them a hot lead"
}`,
    },
  ], 512, 0.1);

  try {
    return JSON.parse(repairJSON(result));
  } catch (e) {
    return {
      keywords: [prompt],
      industry: prompt,
      city: null,
      country: null,
      job_titles: ["CEO", "Owner", "Marketing Manager"],
    };
  }
}

async function searchApolloOrganizations(searchParams) {
  try {
    if (!process.env.APOLLO_API_KEY) return null;

    const body = {
      page: 1,
      per_page: 25,
    };

    // Keywords as array
    if (searchParams.keywords?.length > 0) {
      body.q_organization_keyword_tags = searchParams.keywords;
    }

    // Location
    const locationParts = [];
    if (searchParams.city) locationParts.push(searchParams.city);
    if (searchParams.country) locationParts.push(searchParams.country);
    if (locationParts.length > 0) {
      body.organization_locations = [locationParts.join(', ')];
    }

    // Company size
    if (searchParams.company_size_max) {
      body.organization_num_employees_ranges = [`1,${searchParams.company_size_max}`];
    }

    console.log("Apollo org body:", JSON.stringify(body));

    const res = await fetch("https://api.apollo.io/v1/organizations/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
        "X-Api-Key": process.env.APOLLO_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const responseText = await res.text();
    console.log("Apollo org response:", res.status, responseText.slice(0, 300));

    if (!res.ok) return null;

    const data = JSON.parse(responseText);
    return data.organizations || null;
  } catch (e) {
    console.error("Apollo org search error:", e.message);
    return null;
  }
}

async function getMetaAds(companyName) {
  try {
    if (!process.env.APIFY_API_KEY) return null;
    const searchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(companyName)}&search_type=keyword_unordered`;

    const runRes = await fetch('https://api.apify.com/v2/acts/apify~facebook-ads-scraper/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.APIFY_API_KEY}`,
      },
      body: JSON.stringify({
        startUrls: [{ url: searchUrl }],
        maxAds: 5,
        activeStatus: 'ACTIVE',
      }),
    });

    if (!runRes.ok) return null;
    const runData = await runRes.json();
    const runId = runData.data?.id;
    if (!runId) return null;

    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
        headers: { 'Authorization': `Bearer ${process.env.APIFY_API_KEY}` },
      });
      const statusData = await statusRes.json();
      const status = statusData.data?.status;
      if (status === 'SUCCEEDED') {
        const datasetId = statusData.data.defaultDatasetId;
        const resultsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?limit=5`, {
          headers: { 'Authorization': `Bearer ${process.env.APIFY_API_KEY}` },
        });
        const items = await resultsRes.json();
        return Array.isArray(items) && items.length > 0 ? items : null;
      }
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) return null;
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function getHunterEmails(domain) {
  try {
    if (!process.env.HUNTER_API_KEY) return [];
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&limit=2&api_key=${process.env.HUNTER_API_KEY}`);
    const data = await res.json();
    if (!data.data?.emails?.length) return [];
    return data.data.emails.slice(0, 2).map(e => ({
      name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
      title: e.position || 'Unknown',
      email: e.value,
      decision_maker_score: ['ceo', 'owner', 'founder', 'director', 'cmo', 'vp'].some(t => e.position?.toLowerCase().includes(t)) ? 9 : 6,
    }));
  } catch (e) {
    return [];
  }
}

export async function POST(request) {
  try {
    const { prompt } = await request.json();
    if (!prompt) return Response.json({ error: "Prompt is required" }, { status: 400 });

    const searchParams = await parsePrompt(prompt);
    console.log("Search params:", JSON.stringify(searchParams));

    const apolloOrgs = await searchApolloOrganizations(searchParams);
    console.log(`Apollo orgs: ${apolloOrgs?.length || 0}`);

    const companiesMap = new Map();

    if (apolloOrgs?.length > 0) {
      for (const org of apolloOrgs) {
        const domain = org.primary_domain || org.website_url?.replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (!domain) continue;

        companiesMap.set(domain, {
          company_name: org.name,
          domain,
          industry: org.industry || 'Unknown',
          location: [org.city, org.state, org.country].filter(Boolean).join(', '),
          company_size: org.num_employees,
          estimated_revenue: org.annual_revenue_printed || null,
          founded_year: org.founded_year || null,
          linkedin_url: org.linkedin_url || null,
          phone: org.phone || null,
          website: org.website_url || null,
          technologies: org.current_technologies?.map(t => t.name) || [],
          contacts: [],
        });
      }
    }

    const companies = Array.from(companiesMap.values()).slice(0, 20);
    console.log(`Total unique companies: ${companies.length}`);

    if (companies.length === 0) {
      return Response.json({
        error: "No companies found. Try broader keywords like 'gym' instead of 'gyms in Dubai', or try a different location format.",
        prompt,
        search_params: searchParams,
        debug: "Apollo returned 0 results — try simpler keywords",
      }, { status: 404 });
    }

    // Check Meta ads + Hunter emails for top companies in parallel
    const topCompanies = companies.slice(0, 3);
    const [metaChecks, hunterResults] = await Promise.all([
      Promise.all(topCompanies.map(c => getMetaAds(c.company_name))),
      Promise.all(companies.slice(0, 8).map(c => c.domain ? getHunterEmails(c.domain) : [])),
    ]);

    topCompanies.forEach((company, i) => {
      if (metaChecks[i]?.length > 0) {
        company.meta_ads = metaChecks[i].length;
        company.meta_active = true;
        company.meta_ads_data = metaChecks[i].slice(0, 2).map(ad => ({
          page: ad.pageName,
          body: ad.adCreativeBody?.slice(0, 100),
          snapshot: ad.adSnapshotUrl,
        }));
      }
    });

    companies.slice(0, 8).forEach((company, i) => {
      if (hunterResults[i]?.length > 0) {
        company.contacts = hunterResults[i];
      }
    });

    const qualificationResult = await groq([
      {
        role: "system",
        content: "You qualify leads for a digital marketing agency. Return ONLY valid JSON. No markdown. Start with {",
      },
      {
        role: "user",
        content: `Original search: "${prompt}"

Companies found from Apollo database:
${JSON.stringify(companies, null, 2).slice(0, 6000)}

Qualify each company. Score them, identify pain points, create personalised outreach. Use ONLY the exact company names and domains from the data above.

Return JSON:
{
  "total_found": ${companies.length},
  "search_summary": "Brief summary of what was found",
  "leads": [
    {
      "company_name": "exact name from data",
      "domain": "exact domain from data",
      "industry": "industry from data",
      "location": "location from data",
      "company_size": "size from data",
      "estimated_revenue": "revenue from data or null",
      "technologies_detected": ["tech1", "tech2"],
      "linkedin_url": "url from data or null",
      "signal_score": 75,
      "hot_lead": true,
      "why_qualified": "specific reason this matches the search",
      "ad_activity": {
        "meta": {"active": false, "ad_count": "unknown", "spend_estimate": "unknown"},
        "google": {"active": false},
        "linkedin": {"active": false}
      },
      "pain_points": ["pain point 1", "pain point 2", "pain point 3"],
      "best_angle": "specific outreach angle for this company",
      "dm_opener": "Personalised ready-to-send DM",
      "email_subject": "Specific subject line",
      "whatsapp_message": "Short WhatsApp message",
      "contacts": []
    }
  ]
}`,
      },
    ], 4096, 0.3);

    let leadsData;
    try {
      leadsData = JSON.parse(repairJSON(qualificationResult));
    } catch (e) {
      throw new Error(`Failed to parse leads: ${e.message}`);
    }

    // Merge real contacts and meta ads
    if (leadsData.leads?.length > 0) {
      leadsData.leads = leadsData.leads.map(lead => {
        const apolloCompany = companiesMap.get(lead.domain);
        if (apolloCompany?.contacts?.length > 0) {
          lead.contacts = apolloCompany.contacts;
        }
        const metaIdx = topCompanies.findIndex(c => c.domain === lead.domain);
        if (metaIdx >= 0 && topCompanies[metaIdx].meta_active) {
          lead.ad_activity.meta.active = true;
          lead.ad_activity.meta.real_data = true;
          lead.ad_activity.meta.ad_count = topCompanies[metaIdx].meta_ads?.toString();
          lead.meta_ads_preview = topCompanies[metaIdx].meta_ads_data;
        }
        return lead;
      });
    }

    leadsData.prompt = prompt;
    leadsData.search_params = searchParams;
    leadsData.apollo_results = {
      orgs_found: apolloOrgs?.length || 0,
      unique_companies: companies.length,
    };

    return Response.json(leadsData);
  } catch (error) {
    console.error("Leads API error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}