export async function onRequestPost(context) {
  try {
    // A Cloudflare Settingsben megadott kulcsot olvassa be
    const apiKey = context.env.OPENAI_API_KEY;
    const requestData = await context.request.json();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestData),
    });

    const data = await response.text();
    return new Response(data, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
