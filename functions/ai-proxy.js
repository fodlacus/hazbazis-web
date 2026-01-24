// functions/ai-proxy.js
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const payload = await request.json();
    const apiKey = env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API kulcs hiányzik a környezetből." }),
        { status: 500 }
      );
    }

    // OpenAI API hívás szigorított paraméterekkel
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: payload.messages,
        tools: payload.tools,
        tool_choice: "auto",
        temperature: 0,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: data.error?.message || "OpenAI hiba" }),
        { status: response.status }
      );
    }

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
