import { SUMMARY_SYSTEM_PROMPT } from "@/utils/prompts";

export async function generateSummaryFromHuggingFace(
  pdfText: string,
): Promise<string> {
  const response = await fetch(
    "https://router.huggingface.co/v1/chat/completions", // ✅ correct URL
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta-llama/Llama-3.1-8B-Instruct:cerebras",
        messages: [
          { role: "system", content: SUMMARY_SYSTEM_PROMPT },
          
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("HuggingFace error:", response.status, errorText);
    throw new Error(`HuggingFace error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content ?? "";
}
