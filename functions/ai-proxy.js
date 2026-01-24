// functions/ai-proxy.js
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const payload = await request.json();

    // Szigorú ellenőrzés: csak akkor küldünk tool_choice-t, ha vannak tools-ok
    const openAiBody = {
      model: "gpt-4o-mini",
      messages: payload.messages,
      temperature: 0,
    };

    if (payload.tools && payload.tools.length > 0) {
      openAiBody.tools = payload.tools;
      openAiBody.tool_choice = "auto";
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify(openAiBody),
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
