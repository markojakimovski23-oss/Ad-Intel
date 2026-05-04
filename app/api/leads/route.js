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
      content: "Parse lead generation prompts into Apollo.io search parameters. Return ONLY valid JSON. No markdown.",
    },
    {
      role: "user",
      content: `Parse this lead search request: "${prompt}"

Return JSON with Apollo search parameters:
{
  "keywords": "industry keywords for company search",
  "industry_tags": ["industry1", "industry2"],
  "locations": ["City, Country"],
  "company_size_min": 1,
  "company_size_max": 1000,
  "job_titles": ["CEO", "Owner", "Marketing Manager", "Director"],
  "ad_platforms": ["facebook", "google", "linkedin"],
  "revenue_range": "any specific revenue signal or null",
  "technologies": ["Facebook Ads", "Google Ads"],
  "exclude_keywords": ["enterprise", "global"],
  "signal": "what makes them a hot lead"
}`,
    },
  ], 512, 0.1);

  try {
    return JSON.parse(repairJSON(result));
  } catch (e) {
    return {
      keywords: prompt,
      locations: [],
      job_titles: ["CEO", "Owner", "Marketing Manager"],
      technologies: [],
    };
  }
}

async function searchApollo(searchParams) {
  try {
    if (!process.env.APOLLO_API_KEY) return null;

    // Search for people (contacts) at matching companies
    const body = {
      api_key: process.env.APOLLO_API_KEY,
      q_keywords: searchParams.keywords || "",
      page: 1,
      per_page: 25,
      person_titles: searchParams.job_titles || ["CEO", "Owner", "Founder", "Marketing Director", "Marketing Manager"],
      prospected_by_current_team: ["no"],
    };

    // Add locations if specified
    if (searchParams.locations?.length > 0) {
      body.person_locations = searchParams.locations;
      body.organization_locations = searchParams.locations;
    }

    // Add industry tags
    if (searchParams.industry_tags?.length > 0) {
      body.organization_industry_tag_ids = searchParams.industry_tags;
    }

    // Add company size range
    if (searchParams.company_size_min || searchParams.company_size_max) {
      body.organization_num_employees_ranges = [
        `${searchParams.company_size_min || 1},${searchParams.company_size_max || 500}`
      ];
    }

    // Add technology filters
    if (searchParams.technologies?.length > 0) {
      body.organization_technology_names = searchParams.technologies;
    }

    const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("Apollo error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data.people || null;
  } catch (e) {
    console.error("Apollo search error:", e.message);
    return null;
  }
}

async function searchApolloOrganizations(searchParams) {
  try {
    if (!process.env.APOLLO_API_KEY) return null;

    const body = {
      api_key: process.env.APOLLO_API_KEY,
      q_organization_keyword_tags: searchParams.keywords || "",
      page: 1,
      per_page: 25,
    };

    if (searchParams.locations?.length > 0) {
      body.organization_locations = searchParams.locations;
    }

    if (searchParams.company_size_min || searchParams.company_size_max) {
      body.organization_num_employees_ranges = [
        `${searchParams.company_size_min || 1},${searchParams.company_size_max || 500}`
      ];
    }

    if (searchParams.technologies?.length > 0) {
      body.organization_technology_names = searchParams.technologies;
    }

    const res = await fetch("https://api.apollo.io/v1/organizations/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("Apollo org error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
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

export async function POST(request) {
  try {
    const { prompt } = await request.json();
    if (!prompt) return Response.json({ error: "Prompt is required" }, { status: 400 });

    // Step 1: Parse prompt into search parameters
    const searchParams = await parsePrompt(prompt);
    console.log("Search params:", JSON.stringify(searchParams));

    // Step 2: Search Apollo for real companies and contacts in parallel
    const [apolloPeople, apolloOrgs] = await Promise.all([
      searchApollo(searchParams),
      searchApolloOrganizations(searchParams),
    ]);

    console.log(`Apollo people: ${apolloPeople?.length || 0}, orgs: ${apolloOrgs?.length || 0}`);

    // Step 3: Build lead list from Apollo data
    const companiesMap = new Map();

    // Process people results - group by company
    if (apolloPeople?.length > 0) {
      for (const person of apolloPeople) {
        const org = person.organization;
        if (!org) continue;
        const domain = org.primary_domain || org.website_url?.replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (!domain) continue;

        if (!companiesMap.has(domain)) {
          companiesMap.set(domain, {
            company_name: org.name,
            domain,
            industry: org.industry || 'Unknown',
            location: `${org.city || ''}, ${org.country || ''}`.replace(/^, |, $/, ''),
            company_size: org.num_employees,
            estimated_revenue: org.annual_revenue_printed || null,
            founded_year: org.founded_year || null,
            linkedin_url: org.linkedin_url || null,
            website: org.website_url || null,
            technologies: org.current_technologies?.map(t => t.name) || [],
            contacts: [],
          });
        }

        // Add contact
        const company = companiesMap.get(domain);
        if (company.contacts.length < 3) {
          company.contacts.push({
            name: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
            title: person.title || 'Unknown',
            email: person.email || null,
            linkedin: person.linkedin_url || null,
            phone: person.phone_numbers?.[0]?.sanitized_number || null,
            decision_maker_score: ['ceo', 'owner', 'founder', 'director', 'cmo', 'vp', 'head'].some(t => person.title?.toLowerCase().includes(t)) ? 9 : 6,
          });
        }
      }
    }

    // Process org results
    if (apolloOrgs?.length > 0) {
      for (const org of apolloOrgs) {
        const domain = org.primary_domain || org.website_url?.replace(/^https?:\/\//, '').replace(/\/$/, '');
        if (!domain || companiesMap.has(domain)) continue;

        companiesMap.set(domain, {
          company_name: org.name,
          domain,
          industry: org.industry || 'Unknown',
          location: `${org.city || ''}, ${org.country || ''}`.replace(/^, |, $/, ''),
          company_size: org.num_employees,
          estimated_revenue: org.annual_revenue_printed || null,
          founded_year: org.founded_year || null,
          linkedin_url: org.linkedin_url || null,
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
        error: "No companies found. Try different keywords or location.",
        prompt,
        search_params: searchParams,
      }, { status: 404 });
    }

    // Step 4: Check Meta ads for top 3 companies in parallel
    const topCompanies = companies.slice(0, 3);
    const metaChecks = await Promise.all(
      topCompanies.map(c => getMetaAds(c.company_name))
    );

    topCompanies.forEach((company, i) => {
      if (metaChecks[i]?.length > 0) {
        company.meta_ads = metaChecks[i].length;
        company.meta_active = true;
        company.meta_ads_data = metaChecks[i].slice(0, 2).map(ad => ({
          page: ad.pageName,
          body: ad.adCreativeBody?.slice(0, 100),
          snapshot: ad.adSnapshotUrl,
        }));
      } else {
        company.meta_active = false;
      }
    });

    // Step 5: AI qualifies and scores all leads
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

Qualify each company as a lead for a digital marketing agency. Score them, identify pain points, and create personalised outreach.

Return JSON:
{
  "total_found": ${companies.length},
  "search_summary": "What was found and why these are good leads for the search criteria",
  "data_source": "Apollo.io database — real companies",
  "leads": [
    {
      "company_name": "exact name from data",
      "domain": "exact domain from data",
      "industry": "exact industry from data",
      "location": "exact location from data",
      "company_size": "number of employees",
      "estimated_revenue": "revenue if available",
      "technologies_detected": ["tech1", "tech2"],
      "signal_score": 0-100,
      "hot_lead": true or false,
      "why_qualified": "specific reason this matches the search criteria",
      "ad_activity": {
        "meta": {"active": true or false, "ad_count": "number or unknown", "spend_estimate": "estimate or unknown"},
        "google": {"active": true or false},
        "linkedin": {"active": true or false}
      },
      "pain_points": ["specific pain point 1", "specific pain point 2", "specific pain point 3"],
      "best_angle": "specific personalised outreach angle for this company",
      "dm_opener": "Ready to send personalised DM referencing something specific about their business",
      "email_subject": "Specific email subject line",
      "whatsapp_message": "Short punchy WhatsApp message",
      "contacts": [],
      "linkedin_url": "company linkedin url if available"
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

    // Merge real contacts from Apollo into qualified leads
    if (leadsData.leads?.length > 0) {
      leadsData.leads = leadsData.leads.map(lead => {
        const apolloCompany = companiesMap.get(lead.domain);
        if (apolloCompany?.contacts?.length > 0) {
          lead.contacts = apolloCompany.contacts;
        }
        // Add meta ads data if available
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
      people_found: apolloPeople?.length || 0,
      orgs_found: apolloOrgs?.length || 0,
      unique_companies: companies.length,
    };

    return Response.json(leadsData);
  } catch (error) {
    console.error("Leads API error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}