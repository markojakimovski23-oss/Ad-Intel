function repairJSON(str) {
  // Extract the JSON object
  const match = str.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in response");
  let json = match[0];

  // Fix common AI JSON mistakes
  json = json
    .replace(/,\s*}/g, '}')           // trailing commas in objects
    .replace(/,\s*]/g, ']')           // trailing commas in arrays
    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // unquoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"')  // single quoted values
    .replace(/\n/g, ' ')              // newlines inside strings
    .replace(/\t/g, ' ')              // tabs
    .replace(/\\'/g, "'")             // escaped single quotes
    .replace(/([^\\])\\([^"\\\/bfnrtu])/g, '$1$2'); // bad escape sequences

  return json;
}

async function getMetaAds(domain) {
  try {
    if (!process.env.APIFY_API_KEY) return null;
    const companyName = domain.replace(/\.(com|net|org|io|co|uk|de|fr|es|it|nl|au|ca|mx|br|in|ae|sa).*/, '');
    const searchUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(companyName)}&search_type=keyword_unordered`;

    const runRes = await fetch('https://api.apify.com/v2/acts/apify~facebook-ads-scraper/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.APIFY_API_KEY}`,
      },
      body: JSON.stringify({
        startUrls: [{ url: searchUrl }],
        maxAds: 10,
        activeStatus: 'ACTIVE',
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
      if (statusData.data?.status === 'SUCCEEDED') {
        const datasetId = statusData.data.defaultDatasetId;
        const resultsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items`, {
          headers: { 'Authorization': `Bearer ${process.env.APIFY_API_KEY}` },
        });
        const ads = await resultsRes.json();
        return Array.isArray(ads) && ads.length > 0 ? ads : null;
      }
      if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(statusData.data?.status)) return null;
    }
    return null;
  } catch (e) {
    console.error('Apify error:', e.message);
    return null;
  }
}

export async function POST(request) {
  try {
    const { domain } = await request.json();
    if (!domain) return Response.json({ error: "Domain is required" }, { status: 400 });

    const [metaAds, aiResponse] = await Promise.all([
      getMetaAds(domain),
      fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 4096,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content: `You are an expert digital marketing agency analyst. You MUST return ONLY a valid JSON object. 
CRITICAL JSON RULES:
- No trailing commas
- All strings must use double quotes
- No comments
- No markdown, no backticks
- Start response with { and end with }
- All true/false values must be lowercase boolean, not strings`,
            },
            {
              role: "user",
              content: `Analyze the company at domain: ${domain} for a digital marketing agency prospecting tool.
Focus ONLY on last 30 days ad activity. Be specific about weaknesses.

Return this exact JSON structure with real data (no placeholders):

{
  "company_name": "string",
  "domain": "${domain}",
  "industry": "string",
  "company_size": "solo",
  "estimated_revenue": "$500k-2M/yr",
  "years_in_business": "5 years",
  "business_type": "local",
  "growth_stage": "growing",
  "signal_score": 75,
  "hot_lead": true,
  "last_30_days_active": true,
  "signal_summary": "Two sentence summary here.",
  "recommended_angle": "Specific angle here.",
  "biggest_opportunity": "Specific opportunity here.",
  "platforms": {
    "meta": { "active": true, "active_last_30_days": true, "ad_count": "10-20", "spend_estimate": "$2k-5k/mo", "themes": ["theme1", "theme2"], "last_ad_date": "April 2025", "weaknesses": ["weakness1"] },
    "google": { "active": false, "active_last_30_days": false, "ad_count": "0", "spend_estimate": "N/A", "themes": [], "last_ad_date": "N/A", "weaknesses": ["not running google ads"] },
    "linkedin": { "active": false, "active_last_30_days": false, "ad_count": "0", "spend_estimate": "N/A", "themes": [], "last_ad_date": "N/A", "weaknesses": ["no linkedin presence"] },
    "tiktok": { "active": false, "active_last_30_days": false, "spend_estimate": "N/A", "weaknesses": ["not on tiktok"] },
    "youtube": { "active": false, "active_last_30_days": false, "spend_estimate": "N/A", "weaknesses": ["no youtube ads"] }
  },
  "pain_points": {
    "ads": [{ "issue": "specific issue", "severity": "high", "fix": "what to do" }],
    "website": [{ "issue": "specific issue", "severity": "medium", "fix": "what to do" }],
    "seo": [{ "issue": "specific issue", "severity": "medium", "fix": "what to do" }],
    "social_media": [{ "issue": "specific issue", "severity": "high", "fix": "what to do" }],
    "email_marketing": [{ "issue": "specific issue", "severity": "high", "fix": "what to do" }],
    "lead_generation": [{ "issue": "specific issue", "severity": "high", "fix": "what to do" }],
    "reputation": [{ "issue": "specific issue", "severity": "low", "fix": "what to do" }],
    "content": [{ "issue": "specific issue", "severity": "medium", "fix": "what to do" }],
    "competitive": [{ "issue": "specific issue", "severity": "medium", "fix": "what to do" }],
    "operations": [{ "issue": "specific issue", "severity": "low", "fix": "what to do" }]
  },
  "intent_signals": [
    { "signal": "specific signal", "meaning": "what this means" }
  ],
  "services_to_pitch": [
    { "service": "Meta Ads Management", "reason": "specific reason", "priority": "high" }
  ],
  "outreach": {
    "best_channel": "instagram",
    "best_angle": "specific angle",
    "dm_opener": "Ready to send DM here",
    "email_subject": "Subject line here",
    "email_body": "Full email body here",
    "whatsapp_message": "WhatsApp message here",
    "objections": [
      { "objection": "We already have someone", "response": "How to handle it" }
    ]
  },
  "contacts": [
    { "name": "Likely Name", "title": "CEO", "email": null, "linkedin": null, "decision_maker_score": 9, "best_channel": "instagram" }
  ],
  "competitor_intel": {
    "main_competitors": ["competitor1.com", "competitor2.com"],
    "competitor_advantages": ["what they do better"],
    "gaps_you_can_exploit": ["opportunity 1"]
  },
  "solutions": {
    "quick_wins": [{ "action": "action", "impact": "high", "effort": "low", "timeframe": "1 week", "description": "details" }],
    "short_term": [{ "action": "action", "impact": "high", "effort": "medium", "timeframe": "1 month", "description": "details" }],
    "long_term": [{ "action": "action", "impact": "high", "effort": "high", "timeframe": "3-6 months", "description": "details" }],
    "roi_projection": "ROI estimate here",
    "priority_action": "Most important action here",
    "agency_pitch": "Full pitch paragraph here"
  },
  "total_platforms_active": 1,
  "total_pain_points": 10,
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
      console.error("JSON parse failed:", rawText.slice(0, 500));
      throw new Error(`Failed to parse AI response: ${e.message}`);
    }

    // Inject real Meta ads
    if (metaAds && metaAds.length > 0) {
      result.platforms.meta.active = true;
      result.platforms.meta.active_last_30_days = true;
      result.platforms.meta.ad_count = metaAds.length.toString();
      result.platforms.meta.real_data = true;
      result.platforms.meta.themes = [...new Set(metaAds.slice(0, 5).map(ad => ad.pageName || ad.advertiserName || 'Unknown'))].slice(0, 3);
      result.meta_ads_raw = metaAds.slice(0, 5).map(ad => ({
        id: ad.adArchiveID,
        page: ad.pageName,
        started: ad.startDate,
        platforms: ad.publisherPlatform,
        snapshot: ad.adSnapshotUrl,
        body: ad.adCreativeBody || ad.body || null,
      }));
    } else {
      result.platforms.meta.real_data = false;
    }

    // Hunter.io emails
    if (process.env.HUNTER_API_KEY) {
      try {
        const hunterRes = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&limit=5&api_key=${process.env.HUNTER_API_KEY}`);
        const hunterData = await hunterRes.json();
        if (hunterData.data?.emails?.length > 0) {
          result.contacts = hunterData.data.emails.slice(0, 5).map(e => ({
            name: `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
            title: e.position || 'Unknown',
            email: e.value,
            decision_maker_score: ['ceo', 'owner', 'director', 'founder', 'cmo'].some(t => e.position?.toLowerCase().includes(t)) ? 9 : 6,
            best_channel: 'email',
          }));
        }
      } catch (e) {
        console.error("Hunter error:", e.message);
      }
    }

    return Response.json(result);
  } catch (error) {
    console.error("API error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}