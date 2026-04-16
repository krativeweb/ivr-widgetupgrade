// ======================================================
// GLOBALS
// ======================================================

let ws;
let audioContext;
let micStream;
let processor;

let isConnected = false;
let isCallActive = false;

let audioQueue = [];
let isPlaying = false;


// ======================================================
// CONNECT WEBSOCKET
// ======================================================

function connectSocket() {

  console.log("🔌 Connecting to IVR server...");

  ws = new WebSocket("wss://ivr-widget.onrender.com/browser-call");

  ws.onopen = () => {
    console.log("✅ Connected to server");
    isConnected = true;
  };

  ws.onclose = () => {

    console.log("❌ WebSocket closed");

    isConnected = false;
    isCallActive = false;

    const callBtn = document.getElementById("call-btn");
    const endBtn = document.getElementById("end-btn");
    const mic = document.getElementById("mic-indicator");
    const assistant = document.getElementById("assistant-area");

    if (callBtn) callBtn.style.display = "inline-block";
    if (endBtn) endBtn.style.display = "none";
    if (mic) mic.classList.remove("mic-active");
    if (assistant) assistant.classList.add("hidden");

    hideWave();
  };

  ws.onerror = (err) => {
    console.error("❌ WebSocket error:", err);
  };

  ws.onmessage = handleServerMessage;
}


// ======================================================
// START CALL
// ======================================================

async function startCall() {

  if (isCallActive) return;

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectSocket();
    await waitForSocket();
  }

  console.log("🎧 Creating AudioContext...");

  audioContext = new AudioContext({
    sampleRate: 16000,
    latencyHint: "interactive"
  });

  await audioContext.resume();

  console.log("🎤 Requesting microphone access...");

  micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });

  const assistant = document.getElementById("assistant-area");
  const mic = document.getElementById("mic-indicator");
  const callBtn = document.getElementById("call-btn");
  const endBtn = document.getElementById("end-btn");

  if (assistant) assistant.classList.remove("hidden");
  if (mic) mic.classList.add("mic-active");

  const source = audioContext.createMediaStreamSource(micStream);

  // Flux recommended chunk size (~64ms)
  processor = audioContext.createScriptProcessor(1024, 1, 1);

  source.connect(processor);
  processor.connect(audioContext.destination);

  processor.onaudioprocess = (e) => {

    if (!isConnected || !ws || ws.readyState !== WebSocket.OPEN) return;

    const input = e.inputBuffer.getChannelData(0);
    const buffer = floatTo16BitPCM(input);

    ws.send(JSON.stringify({
      type: "audio",
      audio: arrayBufferToBase64(buffer)
    }));
  };

  isCallActive = true;

  if (callBtn) callBtn.style.display = "none";
  if (endBtn) endBtn.style.display = "inline-block";

  console.log("🚀 Call started successfully");
}


// ======================================================
// STOP CALL
// ======================================================

function stopCall() {

  console.log("📞 Stopping call...");

  if (processor) {
    processor.disconnect();
    processor = null;
  }

  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }

  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  clearAudioQueue();

  const mic = document.getElementById("mic-indicator");
  const callBtn = document.getElementById("call-btn");
  const endBtn = document.getElementById("end-btn");
  const assistant = document.getElementById("assistant-area");

  if (mic) mic.classList.remove("mic-active");
  if (callBtn) callBtn.style.display = "inline-block";
  if (endBtn) endBtn.style.display = "none";
  if (assistant) assistant.classList.add("hidden");

  hideWave();

  isCallActive = false;

  console.log("✅ Call fully stopped");
}


// ======================================================
// HANDLE SERVER AUDIO
// ======================================================

function handleServerMessage(event) {

  let data;

  try {
    data = JSON.parse(event.data);
  } catch (err) {
    console.error("❌ Invalid server message:", err);
    return;
  }

  if (data.type === "audio") {

    if (!audioContext) return;

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    playPCM16(data.audio);
  }

  if (data.type === "clear") {
    console.log("🧹 Clearing audio queue");
    clearAudioQueue();
  }
}


// ======================================================
// PLAY PCM AUDIO
// ======================================================

function playPCM16(base64) {

  const binary = atob(base64);
  const len = binary.length;

  const buffer = new ArrayBuffer(len);
  const view = new Uint8Array(buffer);

  for (let i = 0; i < len; i++) {
    view[i] = binary.charCodeAt(i);
  }

  audioQueue.push(buffer);

  if (!isPlaying) {
    playNextChunk();
  }
}


function playNextChunk() {

  if (audioQueue.length === 0) {
    isPlaying = false;
    hideWave();
    return;
  }

  if (!audioContext) return;

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  isPlaying = true;

  const buffer = audioQueue.shift();
  const pcmData = new Int16Array(buffer);

  const audioBuffer = audioContext.createBuffer(
    1,
    pcmData.length,
    audioContext.sampleRate
  );

  const channel = audioBuffer.getChannelData(0);

  for (let i = 0; i < pcmData.length; i++) {
    channel[i] = pcmData[i] / 32768;
  }

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  showWave();

  source.onended = () => {
    playNextChunk();
  };

  source.start();
}


// ======================================================
// CLEAR AUDIO QUEUE
// ======================================================

function clearAudioQueue() {
  audioQueue = [];
  isPlaying = false;
}


// ======================================================
// UI FUNCTIONS
// ======================================================

function showWave() {

  const wave = document.getElementById("voice-wave");
  const status = document.getElementById("bot-status");
  const avatar = document.querySelector(".bot-avatar");

  if (wave) wave.style.display = "flex";
  if (status) status.innerText = "AI Speaking...";

  // make orb react when AI speaks
  if (avatar) avatar.classList.add("bot-speaking");
}

function hideWave() {

  const wave = document.getElementById("voice-wave");
  const status = document.getElementById("bot-status");
  const avatar = document.querySelector(".bot-avatar");

  if (wave) wave.style.display = "none";
  if (status) status.innerText = "Listening...";

  // stop orb animation
  if (avatar) avatar.classList.remove("bot-speaking");
}


// ======================================================
// HELPERS
// ======================================================

function floatTo16BitPCM(input) {

  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < input.length; i++) {
    let s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(
      i * 2,
      s < 0 ? s * 0x8000 : s * 0x7fff,
      true
    );
  }

  return buffer;
}


function arrayBufferToBase64(buffer) {

  let binary = "";
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}


function waitForSocket() {

  return new Promise(resolve => {

    const interval = setInterval(() => {

      if (ws && ws.readyState === WebSocket.OPEN) {
        clearInterval(interval);
        resolve();
      }

    }, 50);

  });
}


function toggleWidget(){

const widget=document.getElementById("ai-widget");

widget.classList.toggle("hidden");

}


