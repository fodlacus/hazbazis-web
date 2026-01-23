export async function onRequestPost(context) {
  try {
    // 1. A kulcs beolvasása a Cloudflare Settings-ből
    const apiKey = context.env.OPENAI_API_KEY;

    // 2. A böngészőből érkező adatok beolvasása
    const requestData = await context.request.json();

    // 3. Kérés továbbítása az OpenAI felé
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestData),
    });

    const data = await response.text();

    // 4. Válasz visszaküldése a böngészőnek
    return new Response(data, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
