function repairJSON(str) {
  const match = str.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in response");
  let json = match[0];
  json = json
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/:\s*'([^']*)'/g, ': "$1"')
    .replace(/([^\\])\\([^"\\\/bfnrtu])/g, '$1$2');
  return json;
}

async function searchWeb(query) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1024,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: "You are a web research assistant. Search your knowledge for the most accurate and recent information available. Be specific and factual.",
          },
          {
            role: "user",
            content: query,
          },
        ],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error("Search error:", e.message);
    return null;
  }
}

async function getMetaAds(domain) {
  try {
    if (!process.env.APIFY_API_KEY) return null;
    const companyName = domain.replace(/\.(com|net|org|io|co|uk|de|fr|es|it|nl|au|ca|mx|br|in|ae|sa|app|ai).*/, '');
    const searchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(companyName)}&search_type=keyword_unordered`;

    const runRes = await fetch('https://api.apify.com/v2/acts/apify~facebook-ads-scraper/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.APIFY_API_KEY}`,
      },
      body: JSON.stringify({
        startUrls: [{ url: searchUrl }],
        maxAds: 15,
        activeStatus: 'ACTIVE',
      }),
    });

    if (!runRes.ok) return null;
    const runData = await runRes.json();
    const runId = runData.data?.id;
    if (!runId) return null;

    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
        headers: { 'Authorization': `Bearer ${process.env.APIFY_API_KEY}` },
      });
      const statusData = await statusRes.json();
      const status = statusData.data?.status;

      if (status === 'SUCCEEDED') {
        const datasetId = statusData.data.defaultDatasetId;
        const resultsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?limit=15`, {
          headers: { 'Authorization': `Bearer ${process.env.APIFY_API_KEY}` },
        });
        const items = await resultsRes.json();
        return Array.isArray(items) && items.length > 0 ? items : null;
      }
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) return null;
    }
    return null;
  } catch (e) {
    console.error('Apify Meta error:', e.message);
    return null;
  }
}

async function getLinkedInAds(domain) {
  try {
    if (!process.env.APIFY_API_KEY) return null;
    const companyName = domain.replace(/\.(com|net|org|io|co|uk|de|fr|es|it|nl|au|ca|mx|br|in|ae|sa|app|ai).*/, '');

    const runRes = await fetch('https://api.apify.com/v2/acts/apimaestro~linkedin-ad-library-scraper/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.APIFY_API_KEY}`,
      },
      body: JSON.stringify({
        searchQuery: companyName,
        maxResults: 10,
      }),
    });

    if (!runRes.ok) return null;
    const runData = await runRes.json();
    const runId = runData.data?.id;
    if (!runId) return null;

    for (let i = 0; i < 12; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
        headers: { 'Authorization': `Bearer ${process.env.APIFY_API_KEY}` },
      });
      const statusData = await statusRes.json();
      const status = statusData.data?.status;

      if (status === 'SUCCEEDED') {
        const datasetId = statusData.data.defaultDatasetId;
        const resultsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?limit=10`, {
          headers: { 'Authorization': `Bearer ${process.env.APIFY_API_KEY}` },
        });
        const items = await resultsRes.json();
        return Array.isArray(items) && items.length > 0 ? items : null;
      }
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) return null;
    }
    return null;
  } catch (e) {
    console.error('Apify LinkedIn error:', e.message);
    return null;
  }
}

async function getHunterEmails(domain) {
  try {
    if (!process.env.HUNTER_API_KEY) return null;
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&limit=5&api_key=${process.env.HUNTER_API_KEY}`);
    const data = await res.json();
    if (!data.data?.emails?.length) return null;
    return data.data.emails.slice(0, 5).map(e => ({
      name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
      title: e.position || 'Unknown',
      email: e.value,
      decision_maker_score: ['ceo', 'owner', 'director', 'founder', 'cmo', 'head', 'vp'].some(t => e.position?.toLowerCase().includes(t)) ? 9 : 6,
      best_channel: 'email',
    }));
  } catch (e) {
    console.error('Hunter error:', e.message);
    return null;
  }
}

export async function POST(request) {
  try {
    const { domain } = await request.json();
    if (!domain) return Response.json({ error: "Domain is required" }, { status: 400 });

    // Run all data fetching in parallel
    const [metaAds, linkedInAds, hunterEmails, companyResearch, aiResponse] = await Promise.all([
      getMetaAds(domain),
      getLinkedInAds(domain),
      getHunterEmails(domain),
      searchWeb(`Research the company at ${domain}: their industry, company size, estimated revenue, years in business, what products or services they sell, their target market, recent news, and marketing strategy. Be specific and detailed.`),
      fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 4096,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: `You are an expert digital marketing agency analyst. Return ONLY valid JSON. No markdown, no backticks, no trailing commas, no comments. Start with { and end with }. All boolean values must be true or false (not strings).`,
            },
            {
              role: "user",
              content: `Analyze the company at domain: ${domain} for a digital marketing agency prospecting tool.
Focus specifically on the LAST 30 DAYS of ad activity. Be brutally honest about every marketing weakness.
Every field must have real specific data for ${domain} — no placeholders.

Return this exact JSON structure:

{
  "company_name": "real company name",
  "domain": "${domain}",
  "industry": "specific industry",
  "company_size": "solo/small/medium/large/enterprise",
  "estimated_revenue": "$X-Xm/yr",
  "years_in_business": "X years",
  "business_type": "local/ecommerce/b2b/saas/service",
  "growth_stage": "startup/growing/established/stagnant",
  "signal_score": 75,
  "hot_lead": true,
  "last_30_days_active": true,
  "signal_summary": "Two specific sentences about their CURRENT marketing situation right now.",
  "recommended_angle": "Specific outreach angle based on their biggest current weakness.",
  "biggest_opportunity": "The single biggest gap your agency can fill for them right now.",
  "platforms": {
    "meta": {
      "active": true,
      "active_last_30_days": true,
      "ad_count": "10-20",
      "spend_estimate": "$2k-5k/mo",
      "themes": ["specific theme 1", "specific theme 2"],
      "last_ad_date": "April 2025",
      "weaknesses": ["specific weakness 1", "specific weakness 2"]
    },
    "google": {
      "active": true,
      "active_last_30_days": true,
      "ad_count": "5-10",
      "spend_estimate": "$1k-3k/mo",
      "themes": ["specific theme"],
      "last_ad_date": "April 2025",
      "weaknesses": ["specific weakness"]
    },
    "linkedin": {
      "active": false,
      "active_last_30_days": false,
      "ad_count": "0",
      "spend_estimate": "N/A",
      "themes": [],
      "last_ad_date": "N/A",
      "weaknesses": ["specific weakness"]
    },
    "tiktok": {
      "active": false,
      "active_last_30_days": false,
      "spend_estimate": "N/A",
      "weaknesses": ["specific weakness"]
    },
    "youtube": {
      "active": false,
      "active_last_30_days": false,
      "spend_estimate": "N/A",
      "weaknesses": ["specific weakness"]
    }
  },
  "pain_points": {
    "ads": [
      {"issue": "specific issue for this company", "severity": "high", "fix": "specific fix your agency provides"},
      {"issue": "specific issue 2", "severity": "medium", "fix": "specific fix 2"}
    ],
    "website": [
      {"issue": "specific issue", "severity": "high", "fix": "specific fix"},
      {"issue": "specific issue 2", "severity": "medium", "fix": "specific fix 2"}
    ],
    "seo": [
      {"issue": "specific issue", "severity": "medium", "fix": "specific fix"},
      {"issue": "specific issue 2", "severity": "low", "fix": "specific fix 2"}
    ],
    "social_media": [
      {"issue": "specific issue", "severity": "high", "fix": "specific fix"},
      {"issue": "specific issue 2", "severity": "medium", "fix": "specific fix 2"}
    ],
    "email_marketing": [
      {"issue": "specific issue", "severity": "high", "fix": "specific fix"},
      {"issue": "specific issue 2", "severity": "medium", "fix": "specific fix 2"}
    ],
    "lead_generation": [
      {"issue": "specific issue", "severity": "high", "fix": "specific fix"},
      {"issue": "specific issue 2", "severity": "medium", "fix": "specific fix 2"}
    ],
    "reputation": [
      {"issue": "specific issue", "severity": "low", "fix": "specific fix"}
    ],
    "content": [
      {"issue": "specific issue", "severity": "medium", "fix": "specific fix"},
      {"issue": "specific issue 2", "severity": "low", "fix": "specific fix 2"}
    ],
    "competitive": [
      {"issue": "specific issue", "severity": "medium", "fix": "specific fix"},
      {"issue": "specific issue 2", "severity": "high", "fix": "specific fix 2"}
    ],
    "operations": [
      {"issue": "specific issue", "severity": "low", "fix": "specific fix"}
    ]
  },
  "intent_signals": [
    {"signal": "specific signal", "meaning": "what this means for your outreach"},
    {"signal": "specific signal 2", "meaning": "what this means 2"},
    {"signal": "specific signal 3", "meaning": "what this means 3"}
  ],
  "services_to_pitch": [
    {"service": "specific service name", "reason": "specific reason for this company", "priority": "high"},
    {"service": "specific service 2", "reason": "specific reason 2", "priority": "medium"},
    {"service": "specific service 3", "reason": "specific reason 3", "priority": "low"}
  ],
  "outreach": {
    "best_channel": "instagram",
    "best_angle": "Specific angle tailored to their exact situation and pain points",
    "dm_opener": "Personalised DM referencing something specific about their business and ads",
    "email_subject": "Specific subject line that references their company or industry",
    "email_body": "Full personalised email body. Dear [Name], I noticed [specific thing about their marketing]. I help [industry] businesses [specific result]. For example [relevant case study angle]. Would you be open to a 15 min call this week? Best, Marko",
    "whatsapp_message": "Short punchy WhatsApp message referencing something specific about their ads or business",
    "call_script": "Full cold call script: Hi is this [Name]? Great, I am Marko from Digital MA. I was looking at [company] ads and noticed [specific observation]. I help businesses like yours [specific result]. Do you have 2 minutes?",
    "objections": [
      {"objection": "We already have someone doing our marketing", "response": "Specific tailored response"},
      {"objection": "We don't have budget right now", "response": "Specific tailored response"},
      {"objection": "We are not interested", "response": "Specific tailored response"}
    ]
  },
  "contacts": [
    {"name": "Most likely decision maker name", "title": "CEO/Owner/Marketing Director", "email": null, "linkedin": null, "decision_maker_score": 9, "best_channel": "instagram"},
    {"name": "Second contact name", "title": "Marketing Manager", "email": null, "linkedin": null, "decision_maker_score": 7, "best_channel": "email"}
  ],
  "competitor_intel": {
    "main_competitors": ["competitor1.com", "competitor2.com", "competitor3.com"],
    "competitor_advantages": ["specific thing competitors do better 1", "specific thing 2", "specific thing 3"],
    "gaps_you_can_exploit": ["specific gap 1 you can use to win the pitch", "specific gap 2", "specific gap 3"]
  },
  "solutions": {
    "quick_wins": [
      {"action": "specific action", "impact": "high", "effort": "low", "timeframe": "1 week", "description": "Detailed explanation of exactly what to do and what result to expect"},
      {"action": "specific action 2", "impact": "high", "effort": "low", "timeframe": "2 weeks", "description": "Detailed explanation 2"}
    ],
    "short_term": [
      {"action": "specific action", "impact": "high", "effort": "medium", "timeframe": "1 month", "description": "Detailed explanation"},
      {"action": "specific action 2", "impact": "medium", "effort": "medium", "timeframe": "2 months", "description": "Detailed explanation 2"}
    ],
    "long_term": [
      {"action": "specific action", "impact": "high", "effort": "high", "timeframe": "3-6 months", "description": "Detailed explanation"},
      {"action": "specific action 2", "impact": "high", "effort": "high", "timeframe": "6 months", "description": "Detailed explanation 2"}
    ],
    "roi_projection": "Specific ROI projection: if they fix the top 3 issues, estimated X% increase in leads and $X additional monthly revenue within X months based on industry benchmarks.",
    "priority_action": "The single most important thing they should fix first, why it matters most, and what result fixing it will produce.",
    "agency_pitch": "Full 3-4 sentence pitch specific to this company. Reference their actual situation, what you noticed about their marketing, what results you can deliver, and why now is the right time."
  },
  "total_platforms_active": 2,
  "total_pain_points": 15,
  "last_ad_seen": "April 2025"
}`,
            },
          ],
        }),
      }),
    ]);

    if (!aiResponse.ok) {
      const err = await aiResponse.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Groq API error ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawText = aiData.choices?.[0]?.message?.content?.trim();
    if (!rawText) throw new Error("Empty response from Groq");

    let result;
    try {
      result = JSON.parse(repairJSON(rawText));
    } catch (e) {
      console.error("JSON parse failed. Raw:", rawText.slice(0, 500));
      throw new Error(`Failed to parse AI response: ${e.message}`);
    }

    // Inject real Meta ads
    if (metaAds && metaAds.length > 0) {
      result.platforms.meta.active = true;
      result.platforms.meta.active_last_30_days = true;
      result.platforms.meta.ad_count = metaAds.length.toString();
      result.platforms.meta.real_data = true;
      result.platforms.meta.themes = [...new Set(metaAds.slice(0, 5).map(ad => ad.pageName || ad.advertiserName).filter(Boolean))].slice(0, 3);
      result.meta_ads_raw = metaAds.slice(0, 5).map(ad => ({
        id: ad.adArchiveID || ad.id,
        page: ad.pageName || ad.advertiserName,
        started: ad.startDate || ad.createdAt,
        platforms: ad.publisherPlatform,
        snapshot: ad.adSnapshotUrl || ad.url,
        body: ad.adCreativeBody || ad.body || ad.description || null,
      }));
    } else {
      result.platforms.meta.real_data = false;
    }

    // Inject real LinkedIn ads
    if (linkedInAds && linkedInAds.length > 0) {
      result.platforms.linkedin.active = true;
      result.platforms.linkedin.active_last_30_days = true;
      result.platforms.linkedin.ad_count = linkedInAds.length.toString();
      result.platforms.linkedin.real_data = true;
      result.linkedin_ads_raw = linkedInAds.slice(0, 5).map(ad => ({
        advertiser: ad.advertiserName || ad.companyName,
        headline: ad.headline || ad.title,
        body: ad.body || ad.description,
        started: ad.startDate || ad.createdAt,
        url: ad.url || ad.adUrl,
      }));
    } else {
      result.platforms.linkedin.real_data = false;
    }

    // Inject real Hunter emails
    if (hunterEmails) {
      result.contacts = hunterEmails;
    }

    // Add company research context
    if (companyResearch) {
      result.company_research = companyResearch;
    }

    return Response.json(result);
  } catch (error) {
    console.error("API error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}