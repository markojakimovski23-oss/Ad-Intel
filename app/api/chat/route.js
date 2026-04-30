export async function POST(request) {
  try {
    const { messages, companyContext } = await request.json();

    const systemPrompt = `You are an elite digital marketing strategist and analyst working for Digital MA, a digital marketing agency. You have just completed a full intelligence analysis on the following company:

COMPANY INTELLIGENCE:
${JSON.stringify(companyContext, null, 2)}

Your job is to help Marko (the agency owner) with anything related to this company:
- Write personalised outreach (DMs, emails, WhatsApp, cold call scripts, LinkedIn messages)
- Build full proposals with pricing
- Identify the best approach and angle
- Research the company deeper
- Analyse competitors
- Write ad copy or strategy for them
- Answer any question about their marketing
- Suggest which services to pitch first and why
- Handle objections

Rules:
- Always reference the actual company data you have
- Never give generic advice — everything must be specific to this company
- Be direct, concise, and actionable
- Format responses clearly with sections when needed
- When writing messages, make them ready to send immediately`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2048,
        temperature: 0.7,
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
    console.error("Chat error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}