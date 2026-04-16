import fetch from "node-fetch";
import { OPENAI_API_KEY } from "./config.js";
import { conn } from "./db.js";
import Redis from "ioredis";

/* =========================
   REDIS (CACHE)
========================= */
const redis = new Redis(
  process.env.REDIS_URL || {
    host: process.env.REDIS_HOST,
    port: 6379,
    password: process.env.REDIS_PASSWORD,
    tls: {},

    maxRetriesPerRequest: null,
    enableReadyCheck: false,

    retryStrategy: (times) => {
      console.log("🔄 Redis retry:", times);
      return Math.min(times * 200, 5000);
    },
  }
);

// ✅ ADD THESE (IMPORTANT)
redis.on("connect", () => console.log("✅ Redis connected"));
redis.on("ready", () => console.log("🚀 Redis ready"));
redis.on("error", (err) =>
  console.log("❌ Redis error handled:", err.message)
);
redis.on("close", () => console.log("⚠️ Redis closed"));
redis.on("reconnecting", () => console.log("🔄 Redis reconnecting..."));

/* =========================
   COSINE SIMILARITY (SAFE)
========================= */
function cosineSimilarity(a, b) {
  if (!a || !b || !Array.isArray(a) || !Array.isArray(b)) return 0;

  let dot = 0,
    normA = 0,
    normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }

  if (normA === 0 || normB === 0) return 0;

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* =========================
   EMBEDDING (CACHE + SAFE)
========================= */
async function getEmbedding(text) {
  try {
    const normalized = text.toLowerCase().trim();
    const cacheKey = `emb:${normalized}`;

    // ✅ cache check
    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log("⚡ Cache hit");
      return JSON.parse(cached);
    }

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: normalized,
      }),
    });

    const json = await res.json();

    if (!json.data || !json.data[0]?.embedding) {
      console.error("❌ Embedding failed:", json);
      return null;
    }

    const embedding = json.data[0].embedding;

    // ✅ save cache (1 day)
    await redis.set(cacheKey, JSON.stringify(embedding), "EX", 86400);

    return embedding;
  } catch (err) {
    console.error("❌ Embedding error:", err);
    return null;
  }
}

/* =========================
   CLEAN TEXT
========================= */
function cleanText(text) {
  if (!text) return "";

  return text
    .replace(/\s+/g, " ")
    .replace(/(drop us a line|make a call)/gi, "")
    .trim();
}

/* =========================
   SAFE EMBEDDING PARSE
========================= */
function parseEmbeddingSafe(value) {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("[")) return null;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/* =========================
   MERGE CHUNKS
========================= */
function mergeChunks(chunks) {
  const merged = [];
  let buffer = "";

  for (const chunk of chunks) {
    if ((buffer + chunk).length < 1000) {
      buffer += " " + chunk;
    } else {
      merged.push(buffer.trim());
      buffer = chunk;
    }
  }

  if (buffer) merged.push(buffer.trim());

  return merged;
}

/* =========================
   CHATGPT-LIKE RESPONSE
========================= */
async function askAI(context, question) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
      content: `
You are a smart AI assistant.

Instructions:
- Use the provided context to answer the question.
- The answer is likely present — extract it clearly.
- Rephrase in simple, natural language.
- Combine multiple pieces if needed.

IMPORTANT:
- Do NOT say "I couldn't find" unless absolutely nothing matches.
- Even partial information → try to answer.

Keep answer short and clear.
`,
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion:\n${question}`,
        },
      ],
    }),
  });

  const json = await res.json();
  return json.choices?.[0]?.message?.content || "No response";
}

/* =========================
   MAIN RAG FUNCTION
========================= */
export async function answerFromBook(question, userId) {
  console.log("🔍 Question:", question);

  const qEmbedding = await getEmbedding(question);
  if (!qEmbedding) return "Error generating embedding.";

  const [rows] = await conn.query(
    `SELECT chunk_text, embedding 
     FROM document_chunks 
     WHERE user_id = ?`,
    [userId],
  );

  if (!rows.length) return "No data found.";

  /* =========================
     HYBRID SEARCH (VECTOR + KEYWORD)
  ========================= */
  const ranked = rows
    .map((r) => {
      const embedding = parseEmbeddingSafe(r.embedding);
      if (!embedding) return null;

      let score = cosineSimilarity(qEmbedding, embedding);

      const text = cleanText(r.chunk_text);
      const lowerText = text.toLowerCase();
      const lowerQuery = question.toLowerCase();

      // 🔥 keyword boost
      let keywordScore = 0;
      const keywords = lowerQuery.split(" ");

      keywords.forEach((word) => {
        if (lowerText.includes(word)) {
          keywordScore += 0.05;
        }
      });

      score += keywordScore;

      return { score, text };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  console.log(
    "📊 Top 10 scores:",
    ranked.slice(0, 10).map((r) => r.score),
  );

  /* =========================
     SMART THRESHOLD SEARCH
  ========================= */
  let threshold = 0.65;
  let topMatches = [];

  while (threshold >= 0.3) {
    topMatches = ranked.filter((r) => r.score > threshold).slice(0, 5);

    if (topMatches.length > 0) {
      console.log(`✅ Found at threshold: ${threshold}`);
      break;
    }

    console.log(`⚠️ Lowering threshold: ${threshold}`);
    threshold -= 0.1;
  }

  /* =========================
     FINAL FALLBACK
  ========================= */
  if (!topMatches.length) {
    console.log("🚨 Using fallback");
    topMatches = ranked.slice(0, 3);
  }

  /* =========================
     CHUNK MERGING
  ========================= */
  const merged = mergeChunks(topMatches.map((r) => r.text));
  const context = merged.join("\n\n");

  console.log(
    "📊 Final Scores:",
    topMatches.map((r) => r.score),
  );

  /* =========================
     FINAL AI RESPONSE
  ========================= */
  return await askAI(context, question);
}
