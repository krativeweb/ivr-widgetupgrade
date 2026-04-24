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
  CONFIRM_END: "CONFIRM_END",
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
  let currentRequestId = 0;
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

    await speakAsync(summary);

    if (firstUserQuestion) {
      console.log("📚 Running RAG for first question:", firstUserQuestion);

      await speakAsync("Now I will answer your question.");

      const answer = await answerFromBook(firstUserQuestion, userId);

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

      const allowBargeIn =
        state === STATE.QA_LOOP || state === STATE.APPOINTMENT;

      // ================= BARGE-IN ONLY =================
      if (isSpeaking && allowBargeIn) {
        console.log("⚡ BARGE-IN allowed → stopping AI");

        stopSpeaking(sessionId);
        ws.send(JSON.stringify({ type: "clear" }));

        queue.length = 0;
        isSpeaking = false;

        currentRequestId++;
        processing = false;
      }

      // 🚫 NO INTERRUPT DURING AI CHAT
      if (state === STATE.AI_CHAT && isSpeaking) {
        console.log("🚫 Ignoring interruption during AI_CHAT");
        return;
      }

      // ================= MAIN PROCESS =================
      console.log("🎤 RAW:", finalText);

      if (processing) return;
      processing = true;

      if (silenceTimer) clearTimeout(silenceTimer);

      const cleaned = cleanInput(finalText);
      const shortResponses = ["no", "nope", "bye", "goodbye"];

      if (!isMeaningful(cleaned) && !shortResponses.includes(cleaned)) {
        processing = false;
        return;
      }

      console.log("👤 User:", cleaned);

      const requestId = ++currentRequestId;

      try {
        const intent = await detectIntent(cleaned);

        // ================= PRIORITY =================

        // 🔹 CONFIRM END
        if (state === STATE.CONFIRM_END) {
          const yes = ["yes", "yeah", "yup", "ok", "sure"];
          const no = ["no", "nope", "nah"];

          if (yes.includes(cleaned)) {
            await speakAsync("Great, let me take some details.");
            state = STATE.APPOINTMENT;
          } else if (no.includes(cleaned)) {
            await speakAsync("Thank you for calling. Goodbye.");
            ws.close();
          } else {
            await speakAsync("Please say yes or no.");
          }

          processing = false;
          return;
        }

        // 🔹 APPOINTMENT FLOW (LOCKED)
        if (state === STATE.APPOINTMENT) {
          let extracted = {};
          try {
            extracted = await extractAppointmentDetails(cleaned);
          } catch { }

          appointmentData.name = extracted.name || appointmentData.name;
          appointmentData.phone = extracted.phone || appointmentData.phone;
          appointmentData.email = extracted.email || appointmentData.email;

          if (extracted.date && extracted.time) {
            appointmentData.time = extracted.date + " " + extracted.time;
          }

          appointmentData.purpose =
            extracted.purpose || appointmentData.purpose;

          const nextField = getNextMissingField(appointmentData);

          if (!nextField) {
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

            // 🛑 STOP EVERYTHING
            queue.length = 0;
            currentRequestId++;

            // 🎤 FINAL SPEAK (no overlap)
            await speakAsync("Your appointment is booked successfully.");
            await speakAsync("Thank you for calling. Goodbye.");

            // 🔒 prevent further processing
            processing = true;
            isClosed = true;

            // 🔌 CLOSE CONNECTION CLEANLY
            setTimeout(() => {
              ws.close();
            }, 500);

            return;
          }

          const prompts = {
            name: "May I know your name?",
            phone: "Please share your phone number.",
            email: "Please share your email address.",
            time: "What is your preferred date and time?",
            purpose: "What is this regarding?"
          };

          await speakAsync(prompts[nextField]);

          processing = false;
          return;
        }

        // ================= INTENTS =================

        if (intent === "END" || intent === "STOP") {
          await speakAsync(
            "Before ending, would you like to book an appointment?"
          );
          state = STATE.CONFIRM_END;
          processing = false;
          return;
        }
        if (
          intent === "BOOK_APPOINTMENT" &&
          (state === STATE.QA_LOOP || state === STATE.CONFIRM_END)
        ) {
          await speakAsync("Sure, I can arrange that.");
          state = STATE.APPOINTMENT;
          processing = false;
          return;
        }

        if (intent === "QUESTION" && state === STATE.QA_LOOP) {
          const answer = await answerFromBook(cleaned, userId);

          if (requestId !== currentRequestId) return;

          await speakAsync(answer);
          await speakAsync("Do you have any other question?");

          processing = false;
          return;
        }

        // ================= STATES =================

        if (state === STATE.AI_CHAT) {
          const reply = await aiChatReply(systemPrompt, cleaned);

          if (requestId !== currentRequestId) return;

          await speakAsync(reply);

          chatCount++;

          if (chatCount >= 3) {
            await speakAsync("Now I will ask you a few questions.");

            state = STATE.SURVEY;
            questionIndex = 0;

            await askNextQuestion();
          }

          processing = false;
          return;
        }

        if (state === STATE.SURVEY) {
          const q = questions[questionIndex - 1];

          if (!q) {
            processing = false;
            return;
          }

          answers.push({
            question: q.question,
            answer: cleaned
          });

          conn.query(
            `INSERT INTO user_answers_widget 
           (user_id, question_id, answer)
           VALUES (?, ?, ?)`,
            [userId, q.id, cleaned]
          );

          if (questionIndex < questions.length) {
            await askNextQuestion();
          } else {
            await finishSurvey();
          }

          processing = false;
          return;
        }

        if (state === STATE.QA_LOOP) {
          const answer = await answerFromBook(cleaned, userId);

          if (requestId !== currentRequestId) return;

          await speakAsync(answer);
          await speakAsync("Do you have any other question?");

          processing = false;
          return;
        }

      } catch (err) {
        console.error("❌ Error:", err);
      }

      processing = false;
    },

    // ================= USER SPEAKING EVENT =================
    () => {
      console.log("🎤 User started speaking");

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "user_speaking" }));
      }
    }
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














