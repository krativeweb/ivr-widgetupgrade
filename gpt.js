import OpenAI from "openai";
import { OPENAI_API_KEY } from "./config.js";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function generateSummary(answers) {

  if (!answers || answers.length === 0) {
    return "Thank you for participating in the survey.";
  }

  const formatted = answers
    .map((a, index) =>
      `Question ${index + 1}: ${a.question}\nAnswer: ${a.answer}`
    )
    .join("\n\n");

  console.log("📤 Sending to GPT:\n", formatted);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are a professional survey voice assistant.

Create a natural spoken summary of the entire survey.

Rules:
- Mention the key answers clearly.
- Combine related answers naturally.
- Do not repeat questions word by word.
- Do not give generic thank-you summary only.
- Make it sound like a spoken closing statement.
- Keep it concise but meaningful.
        `
      },
      {
        role: "user",
        content: formatted
      }
    ],
    temperature: 0.6
  });

  return response.choices[0].message.content;
}
