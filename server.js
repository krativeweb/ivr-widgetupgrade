import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
// import dotenv from "dotenv";
// dotenv.config();
import { createRealtimeSTT } from "./deepgramSTT.js";
import { speak, stopSpeaking, closeConnection } from "./elevenlabsTTS.js";
import { detectIntent } from "./intent.js";
import { answerFromBook } from "./rag.js";
import { generateSummary } from "./gpt.js";
import { cleanInput, isMeaningful } from "./noiseFilter.js";
import { detectEmotion } from "./emotion.js";
import { conn } from "./db.js";
import { PORT } from "./config.js";
import widgetRoutes from "./routes/widget.js";
import cors from "cors";
import fetch from "node-fetch";

/* ================= EXPRESS ================= */

const app = express();
app.use(cors());
app.use(express.static("public"));
app.use(express.json());

const server = http.createServer(app);
app.use("/api", widgetRoutes);
server.listen(PORT, () => {
  console.log("🚀 AI IVR running on port", PORT);
});

/* ================= STATES ================= */


function getNextMissingField(data) {
  if (!data.name) return "name";
  if (!data.phone) return "phone";
  if (!data.email) return "email";
  if (!data.time) return "time";
  if (!data.purpose) return "purpose";
  return null;
}
async function extractAppointmentDetails(text) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `
Extract appointment details.

Return JSON:
{
"name":"",
"phone":"",
"email":"",
"date":"",
"time":"",
"purpose":""
}
            `
          },
          { role: "user", content: text }
        ]
      })
    });

    const data = await res.json();

    return JSON.parse(data.choices[0].message.content);
  } catch {
    return {};
  }
}

async function generateGreeting(systemPrompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Start a conversation with a customer." }
      ]
    })
  });

  const data = await res.json();
  return data.choices[0].message.content;
}


async function aiChatReply(systemPrompt, userText) {
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText }
        ]
      })
    });

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "Can you please repeat?";
  } catch (err) {
    console.error(err);
    return "Sorry, I didn't understand.";
  }
}
const STATE = {
  AI_CHAT: "AI_CHAT",     // 🔥 new
  FIRST_QUERY: "FIRST_QUERY",
  SURVEY: "SURVEY",
  QA_LOOP: "QA_LOOP",
  APPOINTMENT: "APPOINTMENT" // 🔥 ADD THIS
};

/* ================= WEBSOCKET ================= */

const wss = new WebSocketServer({
  server,
  path: "/browser-call"
});

wss.on("connection", async (ws, req) => {
  console.log("🟢 Voice session connected");

  const sessionId = Date.now().toString();
let state = STATE.AI_CHAT;
let chatCount = 0;

  let questions = [];
  let questionIndex = 0;
  let answers = [];
let appointmentData = {
  name: "",
  phone: "",
  email: "",
  time: "",
  purpose: ""
};
  
  let firstUserQuestion = null;

  let processing = false;
  let isClosed = false;
  let isSpeaking = false;

  let silenceTimer = null;
  let surveyFinished = false;

  /* ================= SPEECH QUEUE ================= */

  const queue = [];

  let running = false;

  async function runQueue() {
    if (running) return;

    running = true;

    while (queue.length && !isClosed) {
      const { text, resolve } = queue.shift();

      await speakInternal(text);

      resolve();
    }

    running = false;
  }

  function decodeId(encoded) {
    try {
      return Buffer.from(
        Buffer.from(encoded, "base64").toString(),
        "base64",
      ).toString();
    } catch {
      return null;
    }
  }

  const url = new URL(req.url, "http://localhost");
  const encodedId = url.searchParams.get("id");

  let userId = 1; // fallback
  // let botIntro = "Welcome to MLO Market."; // fallback

  if (encodedId) {
    const decoded = decodeId(encodedId);
    if (decoded) {
      userId = decoded;
    }
  }

    let botIntro = "Welcome!";
let systemPrompt = "You are helpful assistant.";
let role = "assistant";
  try {
const [botRows] = await conn.query(
  `SELECT bot_intro, system_prompt, role 
   FROM national_detailer_ai_bot 
   WHERE user_id = ? 
   LIMIT 1`,
  [userId],
);



if (botRows.length > 0) {
  botIntro = botRows[0].bot_intro || botIntro;
  systemPrompt = botRows[0].system_prompt || systemPrompt;
  role = botRows[0].role || role;
}

    console.log("🤖 Bot Intro:", botIntro);
  } catch (err) {
    console.error("❌ Error fetching bot intro:", err);
  }
  console.log("👤 User ID:", userId);

  function speakAsync(text) {
    if (!text || isClosed) return Promise.resolve();

    return new Promise((resolve) => {
      queue.push({ text, resolve });

      runQueue();
    });
  }

  async function speakInternal(text) {
    console.log("🗣 Bot speaking:", text);

    isSpeaking = true;

    return new Promise((done) => {
      let finished = false;

      speak(sessionId, text, ws, () => {
        if (finished) return;
        finished = true;

        isSpeaking = false;

        done();
      });
    });
  }

  /* ================= SILENCE TIMER ================= */

  function startSilenceTimer(questionText) {
    if (silenceTimer) clearTimeout(silenceTimer);

    silenceTimer = setTimeout(async () => {
      console.log("⏳ Silence detected");

      await speakAsync("I didn't hear anything.");

      await speakAsync(questionText);

      startSilenceTimer(questionText);
    }, 8000);
  }

  /* ================= CLEANUP ================= */

  function cleanup() {
    if (isClosed) return;

    console.log("🧹 Cleaning session:", sessionId);

    if (silenceTimer) clearTimeout(silenceTimer);

    queue.length = 0;

    stopSpeaking(sessionId);
    closeConnection(sessionId);

    isClosed = true;
  }

  ws.on("close", cleanup);
  ws.on("error", cleanup);

  /* ================= LOAD QUESTIONS ================= */

  try {
    console.log("📥 Loading questions from DB...");

    const [rows] = await conn.query(
      `SELECT id, questions AS question 
   FROM national_detailer_knowledgebase_questionss
   WHERE user_id = ? AND is_del = 0
   ORDER BY id ASC`,
      [userId],
    );

    questions = rows;

    console.log("📋 Questions loaded:", questions.length);
  } catch (err) {
    console.error("❌ DB error:", err);

    ws.close();
    return;
  }

  /* ================= ASK QUESTION ================= */

  async function askNextQuestion() {
    console.log("➡️ askNextQuestion called");

    if (questionIndex >= questions.length) {
      console.log("📊 Survey complete");

      await finishSurvey();
      return;
    }

    const q = questions[questionIndex];

    questionIndex++;

    console.log("❓ Asking:", q.question);

    await speakAsync(q.question);

    startSilenceTimer(q.question);
  }

  /* ================= SURVEY COMPLETE ================= */

  async function finishSurvey() {
    if (surveyFinished) {
      console.log("⚠️ Survey already finished — ignoring duplicate call");
      return;
    }

    surveyFinished = true;

    console.log("📊 Generating summary");

    const summary = await generateSummary(answers);

    console.log("📊 Summary:", summary);

    await speakAsync(summary);

    if (firstUserQuestion) {
      console.log("📚 Running RAG for first question:", firstUserQuestion);

      await speakAsync("Now I will answer your question.");

      const answer = await answerFromBook(firstUserQuestion,userId);

      console.log("📚 RAG answer:", answer);

      await speakAsync(answer);
    }

    await speakAsync("Do you have any other question?");

    state = STATE.QA_LOOP;

    console.log("🔄 State changed → QA_LOOP");
  }
  /* ================= STT ================= */

  const stt = createRealtimeSTT(
    sessionId,

    async (finalText) => {
      if (isClosed) return;

if (isSpeaking) {
  console.log("⚡ BARGE-IN detected → stopping AI");

  stopSpeaking(sessionId);

  ws.send(JSON.stringify({
    type: "clear"
  }));

  queue.length = 0; // 🔥 IMPORTANT
  isSpeaking = false;
}

      console.log("🎤 RAW TRANSCRIPT:", finalText);

      if (processing) return;

      processing = true;

      if (silenceTimer) clearTimeout(silenceTimer);

      const cleaned = cleanInput(finalText);

      console.log("🧹 Cleaned:", cleaned);

      const shortResponses = ["no", "nope", "bye", "goodbye"];

      if (!isMeaningful(cleaned) && !shortResponses.includes(cleaned)) {
        console.log("⚠️ Ignored noise");

        processing = false;
        return;
      }

      console.log("👤 User said:", cleaned);

      try {
        console.log("🔎 Detecting emotion + intent...");

        const intent = await detectIntent(cleaned);

        console.log("🧠 Intent:", intent);

        /* STOP */

        if (intent === "STOP") {
          console.log("🛑 STOP detected");

          await speakAsync("Thank you for calling. Goodbye.");

          ws.close();
          return;
        }
        if (intent === "END") {
          console.log("👋 Conversation ended by user");

          await speakAsync("Thank you for calling MLO Market. Goodbye.");

          // 🔥 SEND END SIGNAL
          ws.send(
            JSON.stringify({
              type: "end_call",
            }),
          );

          setTimeout(() => {
            ws.close();
          }, 500);

          return;
        }
          if (intent === "BOOK_APPOINTMENT" && state !== STATE.APPOINTMENT) {
  await speakAsync("Sure, I can arrange that.");
  state = STATE.APPOINTMENT;
  processing = false;
  return;
}

        /* FIRST USER QUESTION */

        /* FIRST USER QUESTION */


                if (state === STATE.APPOINTMENT) {

  const extracted = await extractAppointmentDetails(cleaned);

  appointmentData.name = extracted.name || appointmentData.name;
  appointmentData.phone = extracted.phone || appointmentData.phone;
  appointmentData.email = extracted.email || appointmentData.email;

  if (extracted.date && extracted.time) {
    appointmentData.time = extracted.date + " " + extracted.time;
  }

  appointmentData.purpose = extracted.purpose || appointmentData.purpose;

  const nextField = getNextMissingField(appointmentData);

  // ✅ ALL DONE → SAVE
  if (!nextField) {

    console.log("📅 FINAL:", appointmentData);

    await conn.query(
      `INSERT INTO appointments 
      (user_id, name, phone, email, time, purpose, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        userId,
        appointmentData.name,
        appointmentData.phone,
        appointmentData.email,
        appointmentData.time,
        appointmentData.purpose
      ]
    );

    await speakAsync("Your appointment is booked successfully.");

    appointmentData = {
      name: "",
      phone: "",
      email: "",
      time: "",
      purpose: ""
    };

    state = STATE.QA_LOOP;
    processing = false; // 🔥 ADD THIS

    return;
  }

  // 🔥 ASK ONLY MISSING FIELD
  if (nextField === "name") {
    await speakAsync("May I know your name?");
  }

  if (nextField === "phone") {
    await speakAsync("Please share your phone number.");
  }

  if (nextField === "email") {
    await speakAsync("Please share your email address.");
  }

  if (nextField === "time") {
    await speakAsync("What is your preferred date and time?");
  }

  if (nextField === "purpose") {
    await speakAsync("What is this regarding?");
  }

  processing = false;
  return;
}
        // ================= AI CHAT MODE =================
if (state === STATE.AI_CHAT) {
  console.log("🤖 AI Chat mode");

  const reply = await aiChatReply(systemPrompt, cleaned);

  await speakAsync(reply);

  chatCount++;

  // 👉 After 2–3 interactions → move to survey
if (chatCount >=4 ) {
  await speakAsync("Now I will assist you further. Let me ask you a few questions.");

  state = STATE.SURVEY;
  questionIndex = 0;

  await askNextQuestion(); // 🔥 auto start
}

  processing = false;
  return;
}
        if (state === STATE.FIRST_QUERY) {
          console.log("📌 First user question captured");

          firstUserQuestion = cleaned;

          console.log("📝 Stored user main question:", firstUserQuestion);

          state = STATE.SURVEY;

          console.log("🔄 State changed → SURVEY");

          questionIndex = 0;

          processing = false; // IMPORTANT: release lock

          await speakAsync(
            "Before I answer your question, I need to ask you a few questions.",
          );

          console.log("➡️ Starting survey");

          await askNextQuestion();

          return;
        }


        /* SURVEY */

        if (state === STATE.SURVEY) {
          const q = questions[questionIndex - 1];

          console.log("💾 Processing survey answer");

          answers.push({
            question: q.question,
            answer: cleaned,
          });

          /* SAVE TO DB (background) */

          conn
            .query(
              `INSERT INTO user_answers_widget
    (user_id, question_id, answer)
    VALUES (?, ?, ?)`,
              [userId, q.id, cleaned],
            )
            .catch((err) => {
              console.error("❌ DB error:", err);
            });

          /* NEXT STEP */

          if (questionIndex < questions.length) {
            askNextQuestion(); // 🚀 fast
          } else {
            finishSurvey(); // 🚀 only once
          }

          processing = false;
          return;
        }
        /* QA LOOP */

        /* ================= APPOINTMENT ================= */


        if (state === STATE.QA_LOOP) {
          console.log("📚 Running RAG for follow-up question");

         const answer = await answerFromBook(cleaned, userId);

          console.log("📚 RAG answer:", answer);

          await speakAsync(answer);

          await speakAsync("Do you have any other question?");

          processing = false;
          return;
        }
      } catch (err) {
        console.error("❌ Processing error:", err);
      }

      processing = false;
    },

    /* ================= BARGE-IN DISABLED ================= */

    () => {
      console.log("🎤 User started speaking");

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "user_speaking",
          }),
        );
      }
    },
  );

  /* ================= AUDIO FROM BROWSER ================= */

  ws.on("message", (msg) => {
    if (isClosed) return;

    try {
      const data = JSON.parse(msg.toString());

      if (data.type === "audio") {
        const buffer = Buffer.from(data.audio, "base64");

        stt.sendAudio(buffer);
      }
    } catch (err) {
      console.error("❌ WS error:", err);
    }
  });

  /* ================= START ================= */

  try {
    console.log("🤖 Starting IVR");

await speakAsync(botIntro); // first DB intro

const greeting = await generateGreeting(systemPrompt);
await speakAsync(greeting); // then AI human-like greeting


  } catch (err) {
    console.error("❌ Startup error:", err);

    ws.close();
  }
});














