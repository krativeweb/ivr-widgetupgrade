import WebSocket from "ws";
import { ELEVENLABS_API_KEY, ELEVEN_VOICE_ID } from "./config.js";

const activeConnections = new Map();
const pendingResolvers = new Map();

/* =====================================================
   CREATE CONNECTION (SPEC COMPLIANT)
===================================================== */
function createConnection(sessionId, browserWs) {

  const url =
    `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_VOICE_ID}/stream-input` +
    `?model_id=eleven_flash_v2_5` +
    `&output_format=pcm_16000`;

  console.log("🔌 Connecting to ElevenLabs:", sessionId);

  const ws = new WebSocket(url, {
    headers: { "xi-api-key": ELEVENLABS_API_KEY }
  });

  ws.isReady = false;

  ws.on("open", () => {

    console.log("✅ ElevenLabs connected:", sessionId);

    ws.send(JSON.stringify({
      text: " ",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        use_speaker_boost: true,
        speed: 1
      }
    }));

    setTimeout(() => {
      ws.isReady = true;
    }, 50);

  });

  ws.on("message", (data) => {

    try {

      const msg = JSON.parse(data.toString());

      if (msg.audio && browserWs.readyState === WebSocket.OPEN) {

        console.log("🎵 Audio chunk received:", sessionId);

        browserWs.send(JSON.stringify({
          type: "audio",
          audio: msg.audio
        }));

      }

      if (msg.isFinal) {

        console.log("🏁 TTS completed:", sessionId);

        const resolver = pendingResolvers.get(sessionId);

        if (resolver) {
          resolver();
          pendingResolvers.delete(sessionId);
        }

      }

    } catch (err) {
      console.error("❌ TTS parse error:", err);
    }

  });

  ws.on("close", (code, reason) => {

   console.log("🔌 ElevenLabs closed:", code, reason.toString());

    activeConnections.delete(sessionId);
    pendingResolvers.delete(sessionId);

  });

  ws.on("error", (err) => {
    console.error("❌ ElevenLabs WS Error:", err);
  });

  activeConnections.set(sessionId, ws);

  return ws;
}

/* =====================================================
   SPEAK (FULLY SPEC-COMPLIANT)
===================================================== */
export function speak(sessionId, text, browserWs, onDone) {

  if (!text?.trim()) {
    if (onDone) onDone();
    return;
  }

  let ws = activeConnections.get(sessionId);

  if (!ws) {
    ws = createConnection(sessionId, browserWs);
  }

  const sendText = () => {

    if (!ws.isReady) {
      return setTimeout(sendText, 50);
    }

    console.log("🗣 Sending text to ElevenLabs:", text);

    // 1️⃣ Send text (REQUIRED text field)
    ws.send(JSON.stringify({
      text: text.trim() + " "
    }));

    // 2️⃣ Flush properly (REQUIRED text field included)
ws.send(JSON.stringify({
  text: " ",
  flush: true
}));
   if (onDone) {
  pendingResolvers.set(sessionId, onDone);

  // fallback in case ElevenLabs doesn't send isFinal
  setTimeout(() => {
    const resolver = pendingResolvers.get(sessionId);
    if (resolver) {
      console.log("⚠️ TTS fallback resolve");
      resolver();
      pendingResolvers.delete(sessionId);
    }
  }, 3000);
}
  };

  if (ws.readyState === WebSocket.OPEN) {
    sendText();
  } else {
    ws.once("open", sendText);
  }
}

/* =====================================================
   BARGE-IN (SPEC SAFE)
===================================================== */
export function stopSpeaking(sessionId) {

  const ws = activeConnections.get(sessionId);

  if (ws?.readyState === WebSocket.OPEN) {
    console.log("🛑 Barge-in flush");

    ws.send(JSON.stringify({
      text: " ",
      flush: true
    }));
  }
}

/* =====================================================
   CLOSE CONNECTION (SPEC REQUIRED)
===================================================== */
export function closeConnection(sessionId) {

  const ws = activeConnections.get(sessionId);

  if (ws?.readyState === WebSocket.OPEN) {
    console.log("🔚 Closing ElevenLabs session:", sessionId);

    ws.send(JSON.stringify({
      text: ""
    }));

    ws.close();
  }

  activeConnections.delete(sessionId);
  pendingResolvers.delete(sessionId);
}









