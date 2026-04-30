export async function POST(request) {
  try {
    const { messages, companyContext } = await request.json();

    const systemPrompt = `You are an elite digital marketing agency analyst and strategist working for Digital MA agency. You have just completed a full intelligence analysis on the following company and you know everything about them:

COMPANY INTELLIGENCE REPORT:
${JSON.stringify(companyContext, null, 2)}

Your job is to help the agency owner (Marko) research this company deeper, write outreach messages, build proposals, identify opportunities, and plan how to convert them into a client.

Be specific, direct, and actionable. Always reference the actual company data you have. Never give generic advice — everything must be tailored to this specific company based on the intelligence above.

You can help with:
- Writing personalised outreach (DMs, emails, WhatsApp, cold call scripts)
- Researching the company deeper
- Building full proposals and pricing
- Identifying the best angle to approach them
- Analysing their competitors
- Writing ad copy or strategy for them
- Answering any question about their marketing situation
- Suggesting which services to pitch and in what order

Always be concise but thorough. Format your responses clearly.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2048,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Groq error ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) throw new Error("Empty response");
    return Response.json({ reply });
  } catch (error) {
    console.error("Chat error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}