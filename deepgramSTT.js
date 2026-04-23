import WebSocket from "ws";
import { DEEPGRAM_API_KEY } from "./config.js";

// 🔍 DEBUG (add here)
console.log("🔑 DEEPGRAM KEY:", DEEPGRAM_API_KEY);
console.log("🔑 KEY LENGTH:", DEEPGRAM_API_KEY?.length);

export function createRealtimeSTT(
  sessionId,
  onFinalTranscript,
  onSpeechStart
) {

  const url =
    "wss://api.deepgram.com/v2/listen" +
    "?model=flux-general-en" +
    "&encoding=linear16" +
    "&sample_rate=16000" +
    "&eager_eot_threshold=0.6";
  
const ws = new WebSocket(url, {
  headers: {
    Authorization: `Token ${DEEPGRAM_API_KEY}`,
  },
});

  let speechActive = false;

  ws.on("open", () => {
    console.log("🎤 Deepgram Flux connected:", sessionId);
  });

  ws.on("message", (msg) => {

    let data;

    try {
      data = JSON.parse(msg.toString());
    } catch {
      console.log("⚠️ Non JSON message");
      return;
    }

    // console.log("📡 FULL MESSAGE:", JSON.stringify(data));

    if (data.type !== "TurnInfo") return;

    const turn = data.event;

    // console.log("🔎 Turn event:", turn);

    const transcript = data.transcript;

    // ==========================
    // USER START SPEAKING
    // ==========================

    if (turn === "StartOfTurn") {

      if (!speechActive) {

        speechActive = true;

        console.log("🗣 User started speaking");

        if (onSpeechStart) onSpeechStart();
      }

      if (transcript) {
        console.log("📝 Partial:", transcript);
      }

      return;
    }

    // ==========================
    // PARTIAL UPDATE
    // ==========================

    if (turn === "Update") {

      if (transcript) {
        console.log("📝 Update transcript:", transcript);
      }

      return;
    }

    // ==========================
    // EARLY END
    // ==========================

    if (turn === "EagerEndOfTurn") {

      console.log("⚡ Early transcript:", transcript);

      speechActive = false;

      if (onFinalTranscript && transcript) {
        onFinalTranscript(transcript);
      }

      return;
    }

    // ==========================
    // FINAL END
    // ==========================

    if (turn === "EndOfTurn") {

      console.log("🎤 Final transcript:", transcript);

      speechActive = false;

      if (onFinalTranscript && transcript) {
        onFinalTranscript(transcript);
      }

      return;
    }

  });

  ws.on("error", (err) => {
    console.error("❌ Deepgram Flux error:", err);
  });

  ws.on("close", () => {
    console.log("🔌 Deepgram Flux closed:", sessionId);
  });

  return {

    sendAudio: (buffer) => {

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(buffer);
      }

    },

    close: () => {

      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }

    }

  };

}




