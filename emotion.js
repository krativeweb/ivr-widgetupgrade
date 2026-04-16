// emotion.js

import fetch from "node-fetch";
import { OPENAI_API_KEY } from "./config.js";

export async function detectEmotion(text) {

  if (!text || text.trim().length < 3) {
    return { emotion: "neutral", confidence: 0.5 };
  }

  try {

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `
You are an emotion detection engine.

Classify the emotion of the text.

Allowed emotions:
- happy
- neutral
- sad
- angry
- frustrated
- confused
- excited
- nervous

Return JSON only:
{
  "emotion": "emotion_name",
  "confidence": 0.0-1.0
}
`
          },
          {
            role: "user",
            content: text
          }
        ]
      })
    });

    const json = await res.json();

    const output = json.choices?.[0]?.message?.content;

    return JSON.parse(output);

  } catch (err) {
    return { emotion: "neutral", confidence: 0.5 };
  }
}