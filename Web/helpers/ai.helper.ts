const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

export const aiGenerateAnswer = async (prompt: string) => {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    }),
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(`AI service responded with status ${response.status}`);
  }

  const data = await response.json();

  return data.choices?.[0]?.message?.content || "";
}
