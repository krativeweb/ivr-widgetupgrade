import fetch from "node-fetch";
import { OPENAI_API_KEY } from "./config.js";

export async function detectIntent(text) {
  if (!text) return "ANSWER";

  const t = text
    .toLowerCase()
    .replace(/\b(uh|um|okay|hmm|like|you know)\b/g, "")
    .trim();

    /* ================= END CONVERSATION ================= */
if (
  /\b(no|nope|nah|nothing|nothing else|thats all|that's all|thats it|that's it|that is all|that is it|no thanks|no thank you|not now|im done|i'm done|i am done|finished|all done|thats everything|that's everything|i dont have more|i don't have more|no more questions|nothing more|okay thanks|ok thanks|thanks|thank you|thanks bye|thank you bye|bye|goodbye)\b/.test(t)
) {
  return "END";
}
  if (
  /\b(talk to|speak to|connect me|transfer me|human|agent|representative|manager|advisor|loan officer|call me|callback|schedule|appointment|meeting|help me|support|assist)\b/.test(t)
) {
  return "BOOK_APPOINTMENT";
}

  /* ================= STOP ================= */
  if (
    /\b(exit|quit|cancel|end|goodbye|bye|hang ?up|finish|terminate)\b/.test(t)
  ) {
    return "STOP";
  }

  /* ================= SKIP ================= */
  if (
    /\b(skip|next|move on|continue|go ahead|proceed|another question)\b/.test(t)
  ) {
    return "SKIP";
  }

  /* ================= REPEAT ================= */
  if (
    /\b(repeat|again|say again|come again|pardon|what did you say|can you repeat)\b/.test(
      t,
    )
  ) {
    return "REPEAT";
  }

  /* ================= STRONG QUESTION RULES ================= */

  // Starts with question word
  if (/^(what|why|how|when|where|who|which|whom|whose)\b/.test(t)) {
    return "QUESTION";
  }

  // Modal / auxiliary verbs
  if (
    /^(can|could|would|should|will|do|does|did|is|are|am|was|were)\b/.test(t)
  ) {
    return "QUESTION";
  }

  // Info-seeking phrases
  if (
    /\b(tell me|let me know|i want to know|do you know|may i know|can you tell|could you tell|please tell|explain)\b/.test(
      t,
    )
  ) {
    return "QUESTION";
  }

  // Common IVR info keywords
  if (
    /\b(price|cost|fee|timing|time|location|address|contact|number|email|details|information)\b/.test(
      t,
    )
  ) {
    return "QUESTION";
  }

  // Ends with question mark
  if (/\?$/.test(t)) {
    return "QUESTION";
  }

  /* ================= SMART GPT FALLBACK ================= */

  try {
    // Do NOT use GPT for very short inputs
    if (t.split(" ").length <= 3) {
      return "ANSWER";
    }

    // Do NOT use GPT if contains numbers (likely survey answer)
    if (/\d+/.test(t)) {
      return "ANSWER";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500); // faster timeout

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You are classifying speech from a live phone survey.\n" +
              "If the user is asking for information or clarification, reply QUESTION.\n" +
              "If the user is responding to a survey question with an answer, reply ANSWER.\n" +
              "Reply with only one word: ANSWER or QUESTION.",
          },
          { role: "user", content: text },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return "ANSWER";

    const json = await res.json();

    const result = json.choices?.[0]?.message?.content?.trim().toUpperCase();

    if (result === "QUESTION") return "QUESTION";

    return "ANSWER";
  } catch (err) {
    return "ANSWER";
  }
}



