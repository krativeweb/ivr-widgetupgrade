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

    let cached = null;
    try {
      cached = await redis.get(cacheKey);
    } catch {}

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

    try {
      await redis.set(cacheKey, JSON.stringify(embedding), "EX", 86400);
    } catch {}

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
  try {
    if (!value) return null;
    if (Array.isArray(value)) return value;
    return JSON.parse(value);
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
   🔥 NEW: RERANK FUNCTION
========================= */
async function rerankChunks(question, chunks) {
  try {
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
            content: "Pick the most relevant chunk number.",
          },
          {
            role: "user",
            content: `
Question: ${question}

Chunks:
${chunks.map((c, i) => `${i + 1}. ${c.text}`).join("\n")}

Return only number.
`,
          },
        ],
      }),
    });

    const json = await res.json();
    const index = parseInt(json.choices?.[0]?.message?.content?.trim());

    return chunks[index - 1] || chunks[0];
  } catch {
    return chunks[0];
  }
}

/* =========================
   CHATGPT RESPONSE
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
      max_tokens: 80,
      messages: [
        {
          role: "system",
          content: `
Use context to answer clearly.
Do NOT say "not found" unless truly empty.
Keep answer short.
`,
        },
        {
          role: "user",
          content: `
Context:
${context}

Question:
${question}

Answer:
`,
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
    [userId]
  );

  if (!rows.length) return "No data found.";

  const ranked = rows
    .map((r) => {
      const embedding = parseEmbeddingSafe(r.embedding);
      if (!embedding) return null;

      let score = cosineSimilarity(qEmbedding, embedding);

      const text = cleanText(r.chunk_text);
      const lowerText = text.toLowerCase();
      const lowerQuery = question.toLowerCase();

      let keywordScore = 0;
      lowerQuery.split(" ").forEach((word) => {
        if (lowerText.includes(word)) keywordScore += 0.15;
      });

      score += keywordScore;

      return { score, text };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  console.log("📊 Top scores:", ranked.slice(0, 5).map(r => r.score));

  /* 🔥 CONFIDENCE */
  const topScore = ranked[0]?.score || 0;
  const confidence =
    topScore > 0.75 ? "high" : topScore > 0.55 ? "medium" : "low";

  console.log("🎯 Confidence:", confidence);

  let topMatches = ranked.slice(0, 5);

  /* 🔥 RERANK */
  const bestChunk = await rerankChunks(question, topMatches);

  const context = bestChunk.text;

  let answer = await askAI(context, question);

  if (confidence === "low") {
    answer = "I'm not fully sure, but here's what I found: " + answer;
  }

  return answer;
}
