// Fájl: functions/ai-proxy.js

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const payload = await request.json();
    const apiKey = env.OPENAI_API_KEY;

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "API key is missing in environment." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Az OpenAI hívása - Továbbítjuk a kliens által küldött tools-t és üzeneteket
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: payload.model || "gpt-4o-mini",
        messages: payload.messages,
        tools: payload.tools, // Ez fogadja a kliens oldalon definiált ingatlanTools-t
        tool_choice: payload.tool_choice || "auto",
        temperature: 0, // A precíz adatkinyeréshez a 0-ás temperature a legjobb
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(errorText, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Visszaküldjük a teljes választ, amiből a kliens kiolvassa a tool_calls-t
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
