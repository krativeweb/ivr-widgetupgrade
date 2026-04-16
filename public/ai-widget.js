(function(){

if(window.AI_WIDGET_LOADED) return;
window.AI_WIDGET_LOADED = true;


// ======================================================
// INSERT CSS
// ======================================================


  

const style = document.createElement("style");

style.innerHTML = `


@keyframes rotateGlow{
0%{transform:rotate(0deg)}
100%{transform:rotate(360deg)}
}


#ai-face{
animation:faceIdle 4s ease-in-out infinite;
}

@keyframes faceIdle{
0%{transform:translateY(0px) scale(1)}
50%{transform:translateY(-5px) scale(1.05)}
100%{transform:translateY(0px) scale(1)}
}
#ai-launcher{
position:fixed;
bottom:25px;
right:25px;
width:60px;
height:60px;
border-radius:50%;
background:linear-gradient(135deg,#4CAF50,#00e676);
display:flex;
align-items:center;
justify-content:center;
font-size:26px;
color:white;
cursor:pointer;
box-shadow:0 10px 30px rgba(0,0,0,.4);
transition:.3s;
z-index:999999;
}

#ai-launcher:hover{
transform:scale(1.1);
}

#ai-widget{
  position:relative;
  bottom:0;
  right:0;
  left:0;
  width:100%;
  max-width:100%;
  border-radius:20px 20px 0 0;
  padding:15px;
  color:white;

  border:1px solid transparent;
  background-clip:padding-box;

  box-shadow:
    0 0 0 1px rgba(255,255,255,0.05),
    0 20px 60px rgba(0,0,0,.6),
    0 0 40px rgba(0,255,200,.15);

  transition:.3s;
}

#ai-widget::before{
  content:"";
  position:absolute;
  inset:-1px;
  border-radius:24px;

  background:linear-gradient(
    130deg,
    #00ffc3,
    #4CAF50,
    #00ffc3
  );

  z-index:-1;
  opacity:.25;
  filter:blur(8px);
}

.hidden{
display:none;
}

@keyframes widgetOpen{
from{
opacity:0;
transform:translateY(20px);
}
to{
opacity:1;
transform:translateY(0);
}
}

#ai-header{
display:flex;
justify-content:space-between;
align-items:center;
font-weight:600;
margin-bottom:15px;
}

#close-btn{
cursor:pointer;
opacity:.7;
}

.bot-avatar{
width:90px;
height:90px;
margin:auto;
border-radius:50%;
background:radial-gradient(circle at 30% 30%, #00ffb7, #4CAF50, #003b2f);
box-shadow:0 0 30px rgba(0,255,183,.8);
position:relative;
animation:orbGlow 3s ease-in-out infinite;
}

@keyframes orbGlow{
0%{box-shadow:0 0 20px rgba(0,255,183,.5)}
50%{box-shadow:0 0 45px rgba(0,255,183,1)}
100%{box-shadow:0 0 20px rgba(0,255,183,.5)}
}

.bot-speaking{
animation:orbSpeak 1s infinite alternate;
}

@keyframes orbSpeak{
0%{
transform:scale(1);
box-shadow:0 0 30px #00ffc3;
}
100%{
transform:scale(1.15);
box-shadow:0 0 60px #00ffc3;
}
}

.bot-avatar::after{
content:'';
position:absolute;
width:100%;
height:100%;
border-radius:50%;
background:#00e676;
animation:pulse 2s infinite;
opacity:.4;
}

@keyframes pulse{
0%{transform:scale(1)}
70%{transform:scale(1.7);opacity:0}
100%{opacity:0}
}

#voice-wave{
display:none;
justify-content:center;
gap:5px;
margin:15px 0;
height:40px;
}

#voice-wave span{
width:6px;
background:linear-gradient(to top,#00e676,#00ffc3);
border-radius:4px;
box-shadow:0 0 8px #00e676;
animation:wave 1s infinite ease-in-out;
}

#voice-wave span:nth-child(1){height:10px}
#voice-wave span:nth-child(2){height:20px}
#voice-wave span:nth-child(3){height:30px}
#voice-wave span:nth-child(4){height:20px}
#voice-wave span:nth-child(5){height:10px}

@keyframes wave{
0%{transform:scaleY(.4)}
50%{transform:scaleY(1.3)}
100%{transform:scaleY(.4)}
}

.mic-active{
color:#00ffc3;
animation:micPulse 1.5s infinite;
}

@keyframes micPulse{
0%{text-shadow:0 0 5px #00ffc3}
50%{text-shadow:0 0 18px #00ffc3}
100%{text-shadow:0 0 5px #00ffc3}
}

#bot-status{
text-align:center;
font-size:14px;
color:#ccc;
}

#mic-indicator{
text-align:center;
font-size:30px;
margin-top:10px;
}

.call-controls{
display:flex;
justify-content:center;
gap:20px;
margin-top:20px;
}

#call-btn{
width:65px;
height:65px;
border-radius:50%;
border:none;
background:linear-gradient(135deg,#00ffc3,#4CAF50);
box-shadow:
    0 0 20px rgba(0,255,200,.6),
    inset 0 0 10px rgba(255,255,255,.2);
font-size:26px;
cursor:pointer;
color:white;
box-shadow:0 0 20px rgba(0,230,118,.7);
transition:.3s;
}

#call-btn:hover{
transform:scale(1.1);
}

#end-btn{
width:65px;
height:65px;
border-radius:50%;
border:none;
background:#ff3b30;
font-size:22px;
cursor:pointer;
color:white;
box-shadow:0 0 20px rgba(255,59,48,.7);
transition:.3s;
}

#end-btn:hover{
transform:scale(1.1);
}

.avatar-wrapper{
position:relative;
display:flex;
justify-content:center;
align-items:center;
height:160px;
}



/* face */
#ai-face{
position:relative;
width:110px;
height:110px;
display:block; /* 🔥 FIX */
z-index:2;
}

#face-base{
width:100%;
height:100%;
border-radius:50%;
}

/* mouth */

// #ai-face{
// box-shadow:0 10px 40px rgba(0,255,200,.3);
// }

#ai-widget{
  transform:scale(.9) translateY(20px);
  opacity:0;
}

#ai-widget:not(.hidden){
  transform:scale(1) translateY(0);
  opacity:1;
}

#mic-wave{
display:none;
z-index:2;
}



.glow-ring{
  position:absolute;
  width:150px;
  height:150px;
  border-radius:50%;

  background:conic-gradient(
    from 0deg,
    #00ffc3,
    #4CAF50,
    #00ffc3
  );

  filter:blur(20px);
  opacity:.6;

  animation:rotateGlow 6s linear infinite;
}

.bot-avatar::before{
  content:"";
  position:absolute;
  width:120%;
  height:120%;
  border-radius:50%;
  background:radial-gradient(circle,#00ffc3,transparent 70%);
  animation:pulse 2s infinite;
}

/* 🔥 speaking animation */
.speaking{
animation:glowPulse .7s infinite alternate;
}

@keyframes glowPulse{
0%{transform:scale(1);}
100%{transform:scale(1.35);}
}
#ai-face{
transition:opacity .3s ease;
}

.hidden-avatar{
opacity:0;
pointer-events:none;
}
.glow-ring.speaking{
  box-shadow:
    0 0 40px #00ffc3,
    0 0 80px #00ffc3,
    0 0 120px #00ffc3;

  animation:glowPulse .6s infinite alternate;
}

#assistant-area{
  display:flex;
  flex-direction:column;   /* 🔥 IMPORTANT */
  align-items:center;
  justify-content:center;
  text-align:center;
}

.avatar-wrapper{
  height:auto;
  width:120px;
  flex-shrink:0;
    margin:auto;
}


.glow-ring{
  pointer-events: none;
}
#ai-widget{
  z-index: 9999999;
}

#ai-face{
  z-index: 10;
  position: relative;
}
#ai-face{
  cursor: pointer;
}

#assistant-layout{
  display:flex;
  gap:20px;
  align-items:center;
  justify-content:space-between;
}

/* LEFT SIDE */
.left-banner{
  width:50%;
}

.left-banner img{
  width:100%;
  border-radius:12px;
  object-fit:cover;
}

/* RIGHT SIDE */
.right-avatar{
  width:50%;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  text-align:center;
}

/* responsive */
@media(max-width:768px){
  #assistant-layout{
    flex-direction:column;
  }

  .left-banner,
  .right-avatar{
    width:100%;
  }
}
  #hero-section{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:60px;
  border-radius:20px;

  background: radial-gradient(circle at 70% 50%, #1a0033, #000000 70%);
}

/* LEFT SIDE */
.hero-left{
  width:55%;
}

.hero-left h1{
  font-size:48px;
  font-weight:700;
  line-height:1.2;
  background: linear-gradient(90deg,#7b2ff7,#f107a3);
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
}

.hero-left p{
  margin-top:20px;
  color:#ccc;
  font-size:18px;
}

.cta-btn{
  margin-top:25px;
  padding:12px 22px;
  border-radius:30px;
  border:1px solid #fff;
  background:transparent;
  color:#fff;
  cursor:pointer;
  transition:.3s;
}

.cta-btn:hover{
  background:#fff;
  color:#000;
}

/* RIGHT SIDE */
.hero-right{
  width:45%;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
}

.talk-label{
  margin-top:15px;
  font-weight:600;
  color:#fff;
}

/* AVATAR SIZE BIGGER */
#ai-face{
  width:140px;
  height:140px;
}

/* RESPONSIVE */
@media(max-width:768px){
  #hero-section{
    flex-direction:column;
    text-align:center;
  }

  .hero-left,
  .hero-right{
    width:100%;
  }

  .hero-left h1{
    font-size:32px;
  }
}
  .glow-ring,
#mic-wave {
  pointer-events: none;
}

`;

document.head.appendChild(style);


// ======================================================
// INSERT HTML
// ======================================================

const html = `



<div id="ai-widget">

  <div id="hero-section">

    <!-- LEFT CONTENT -->
    <div class="hero-left">
      <h1>
        Launch your very own <br/>
        <span>voice AI SAAS agency</span>
      </h1>

      <p>
        Add Inbound & Outbound Voice AI Sales Teams To Your Agency 
        With <b>UNLIMITED agents</b>
      </p>

      <button class="cta-btn">Get Started Free</button>
    </div>

    <!-- RIGHT AVATAR -->
    <div class="hero-right">

      <div class="avatar-wrapper">
        <div class="glow-ring"></div>

        <div id="ai-face">
          <img id="face-base"
            src="https://res.cloudinary.com/dj6nklpnu/image/upload/v1774509320/ChatGPT_Image_Mar_26_2026_12_43_41_PM_m7qqsh.png"/>
        </div>

        <canvas id="mic-wave" width="240" height="110"></canvas>
      </div>

      <div class="talk-label">➤ Talk to PELE!</div>

      <div id="voice-wave">
        <span></span><span></span><span></span><span></span><span></span>
      </div>

      <div id="bot-status">Tap to talk with AI</div>


      <div class="call-controls">
        <button id="end-btn" style="display:none;">❌</button>
      </div>

    </div>

  </div>

</div>
`;

document.body.insertAdjacentHTML("beforeend", html);

// ✅ ADD HERE (RIGHT AFTER HTML INSERT)
document.getElementById("ai-face").style.display = "block";
document.getElementById("mic-wave").style.display = "none";
document.getElementById("voice-wave").style.display = "none";


  function getScriptParam(name) {
  const scripts = document.getElementsByTagName("script");

  for (let s of scripts) {
    if (s.src.includes("ai-widget.js")) {
      const url = new URL(s.src);
      return url.searchParams.get(name);
    }
  }
  return null;
}

const encodedId = getScriptParam("id");

if (encodedId) {
  fetch(`https://ivr-widgetupgrade.onrender.com/api/widget-user?id=${encodedId}`)
    .then((res) => res.json())
    .then((res) => {
      if (res.success) {
        updateBotUI(res.user);
      }
    });
}

function updateBotUI(user) {

  const avatar = document.getElementById("face-base");
  const label = document.querySelector(".talk-label");

  // ================= AVATAR =================
  if (avatar) {

    let img = user.bot_image;

    if (img && img !== "null" && img !== "") {
      img = img.replace(/^\/+/, ""); // remove leading slash
      avatar.src = "https://mlomarket.com/uploads/" + img;
    } else {
      avatar.src = "https://res.cloudinary.com/dj6nklpnu/image/upload/v1774509320/ChatGPT_Image_Mar_26_2026_12_43_41_PM_m7qqsh.png";
    }
  }

  // ================= NAME =================
  if (label) {
    let name = user.bot_name;

    if (name && name.trim() !== "") {
      label.innerText = "➤ Talk to " + name;
    } else {
      label.innerText = "➤ Talk to PELE";
    }
  }
}

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
let analyser, dataArray, animationId;
let speakingVolume = 0;
let glowAnimationId = null;
  let currentSource = null;
// ======================================================
// EVENT LISTENERS
// ======================================================


// ❌ REMOVE THIS (important)
// document.getElementById("call-btn").onclick = startCall;

// ✅ ADD THIS (avatar click)
document.querySelector(".avatar-wrapper").onclick = async () => {



  try {
    await startCall();
    // alert("CALL STARTED");
  } catch (e) {
    // alert("ERROR: " + e.message);
    console.error(e);
  }

};

document.addEventListener("click", function(e){
  if(e.target && e.target.id === "end-btn"){
    stopCall();
  }
});


// ======================================================
// CONNECT WEBSOCKET
// ======================================================

function connectSocket(){
  return new Promise((resolve, reject) => {

    if(ws){
      try{ ws.close(); } catch(e){}
      ws = null;
    }

const encodedId = getScriptParam("id") || "";

ws = new WebSocket(
  `wss://https://ivr-widgetupgrade.onrender.com/ws/browser-call?id=${encodedId}`,
);

    ws.onopen = () => {
      console.log("✅ Connected");
      isConnected = true;
      resolve();
    };

    ws.onclose = () => {
      console.log("❌ Closed");
      isConnected = false;
      isCallActive = false;
    };

    ws.onerror = reject;

    ws.onmessage = handleServerMessage;
  });
}

// ======================================================
// START CALL
// ======================================================


const closeBtn = document.getElementById("close-btn");
if(closeBtn){
  closeBtn.onclick = stopCall;
}
async function startCall(){

if(isCallActive) return;

if(!ws || ws.readyState!==WebSocket.OPEN){
await connectSocket();
}

console.log("🎧 Creating AudioContext...");

audioContext=new AudioContext({
sampleRate:16000,
latencyHint:"interactive"
});

await audioContext.resume();

console.log("🎤 Requesting microphone access...");

micStream=await navigator.mediaDevices.getUserMedia({
audio:{
echoCancellation:true,
noiseSuppression:true,
autoGainControl:true
}
});

const assistant=document.getElementById("assistant-area");
const mic=document.getElementById("mic-indicator");
const callBtn=document.getElementById("call-btn");
const endBtn=document.getElementById("end-btn");

if(assistant) assistant.classList.remove("hidden");
if(mic) mic.classList.add("mic-active");

const source=audioContext.createMediaStreamSource(micStream);

processor=audioContext.createScriptProcessor(1024,1,1);

analyser = audioContext.createAnalyser();
analyser.fftSize = 256;

dataArray = new Uint8Array(analyser.frequencyBinCount);

source.connect(analyser);
analyser.connect(processor);
processor.connect(audioContext.destination);

processor.onaudioprocess=(e)=>{

if(!isConnected || !ws || ws.readyState!==WebSocket.OPEN) return;

const input=e.inputBuffer.getChannelData(0);
const buffer=floatTo16BitPCM(input);

ws.send(JSON.stringify({
type:"audio",
audio:arrayBufferToBase64(buffer)
}));

};

isCallActive=true;

if(callBtn) callBtn.style.display="none";
if(endBtn) endBtn.style.display="inline-block";

// console.log("🚀 Call started successfully");
document.getElementById("bot-status").innerText = "Connecting...";
document.getElementById("voice-wave").style.display = "none";
document.getElementById("mic-wave").style.display = "none";
}


// ======================================================
// STOP CALL
// ======================================================
function drawWave(){

if(!analyser) return;

if(animationId){
cancelAnimationFrame(animationId);
animationId = null;
}

const canvas=document.getElementById("mic-wave");
const ctx=canvas.getContext("2d");

function draw(){

animationId=requestAnimationFrame(draw);

analyser.getByteFrequencyData(dataArray);

ctx.clearRect(0,0,canvas.width,canvas.height);

// volume glow
let sum=0;
for(let i=0;i<dataArray.length;i++) sum+=dataArray[i];
let volume=sum/dataArray.length;

const ring=document.querySelector(".glow-ring");
if(ring){
ring.style.transform=`scale(${1+volume/120})`;
ring.style.opacity=0.4+volume/300;
}

/* 🔥 REPLACE THIS PART */
const centerY = canvas.height / 2;

// 🔥 gradient color (premium look)
const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
gradient.addColorStop(0, "#00ffc3");
gradient.addColorStop(0.5, "#4CAF50");
gradient.addColorStop(1, "#00ffc3");

ctx.lineWidth = 3;
ctx.strokeStyle = gradient;
ctx.shadowBlur = 10 + volume / 5;
ctx.shadowColor = "#00ffc3";

ctx.beginPath();

const sliceWidth = canvas.width / dataArray.length;
let x = 0;

for (let i = 0; i < dataArray.length; i++) {

  const v = (dataArray[i] / 128.0) * 0.8;
  const y = centerY + (v - 1) * 40;

  if (i === 0) {
    ctx.moveTo(x, y);
  } else {
    const prevX = x - sliceWidth;
    const prevY = centerY + ((dataArray[i-1]/128.0) - 1) * 40;

    const cx = (prevX + x) / 2;
    const cy = (prevY + y) / 2;

    ctx.quadraticCurveTo(prevX, prevY, cx, cy);
  }

  x += sliceWidth;
}

// 🔥 smooth edges
ctx.lineJoin = "round";
ctx.lineCap = "round";

ctx.stroke();

}

draw();
}

// function updateMouth(){

// const mouth = document.getElementById("mouth");
// if(!mouth) return;

// // normalize volume
// let v = speakingVolume / 100;

// // clamp
// v = Math.max(0, Math.min(v, 1));

// // smooth curve
// let height = 8 + (v * 25);

// // apply
// mouth.style.height = height + "px";

// // slight stretch effect
// mouth.style.transform = `translateX(-50%) scaleX(${1 + v*0.3})`;

// }
  
async function stopCall(){

console.log("📞 Stopping call...");

// 🔴 mark inactive FIRST
isCallActive = false;

if(currentSource){
  try{
    currentSource.onended = null; // stop callback
    currentSource.stop();         // stop audio immediately
  }catch(e){}
  currentSource = null;
}
// ================= CLEANUP =================
if(animationId){
  cancelAnimationFrame(animationId);
  animationId = null;
}

if(glowAnimationId){
  cancelAnimationFrame(glowAnimationId);
  glowAnimationId = null;
}

if(processor){
  processor.disconnect();
  processor = null;
}

// 🔥 CLEAN ANALYSER
if(analyser){
  try{ analyser.disconnect(); }catch(e){}
  analyser = null;
}

if(micStream){
  micStream.getTracks().forEach(track => track.stop());
  micStream = null;
}

if(audioContext){
  try{
    await audioContext.close();
  }catch(e){}
  audioContext = null;
}

// 🔥 SAFE WS CLOSE
if(ws){
  try{
    ws.onclose = null;

    if(ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING){
      ws.close();
    }
  }catch(e){}
  ws = null;
}

// 🔥 RESET AUDIO STATE
audioQueue = [];
isPlaying = false;


// ================= UI RESET =================
const mic = document.getElementById("mic-indicator");
const callBtn = document.getElementById("call-btn");
const endBtn = document.getElementById("end-btn");

if(mic) mic.classList.remove("mic-active");
if(callBtn) callBtn.style.display = "inline-block";
if(endBtn) endBtn.style.display = "none";

document.getElementById("ai-face").style.display = "block";
document.getElementById("mic-wave").style.display = "none";
document.getElementById("voice-wave").style.display = "none";

document.getElementById("bot-status").innerText = "Tap to talk with AI";

// 🔥 RESET RING
const ring = document.querySelector(".glow-ring");
if(ring){
  ring.classList.remove("speaking");
  ring.style.transform = "scale(1)";
  ring.style.opacity = "0.6";
}

// 🔥 DELAY (CRITICAL)
await new Promise(r => setTimeout(r, 300));

console.log("✅ Call fully stopped");
}


// ======================================================
// HANDLE SERVER AUDIO
// ======================================================

function handleServerMessage(event){

let data;

try{
data=JSON.parse(event.data);
}catch(err){
console.error("❌ Invalid server message:",err);
return;
}

if(data.type==="audio"){

if(!audioContext) return;

if(audioContext.state==="suspended"){
audioContext.resume();
}

playPCM16(data.audio);

}

if(data.type==="clear"){
console.log("🧹 Clearing audio queue");
clearAudioQueue();
}

  if(data.type === "end_call"){
  console.log("👋 Ending call from server");

  document.getElementById("bot-status").innerText = "Goodbye 👋";

  setTimeout(() => {
    stopCall(); // 🔥 FULL RESET
  }, 500);

  return;
}

}

// ======================================================
// AUDIO PLAYBACK
// ======================================================

function playPCM16(base64){

const binary=atob(base64);
const len=binary.length;

const buffer=new ArrayBuffer(len);
const view=new Uint8Array(buffer);

for(let i=0;i<len;i++){
view[i]=binary.charCodeAt(i);
}

audioQueue.push(buffer);

if(!isPlaying){
playNextChunk();
}

}

function playNextChunk(){
    // 🔥 MUST BE FIRST LINE
  if(!isCallActive){
    audioQueue = [];
    isPlaying = false;
    return;
  }

if(audioQueue.length===0){
  isPlaying=false;

  // 🔥 ONLY show listening if call is still active
  if(isCallActive){
    hideWave();
  }

  return;
}


if(!audioContext) return;

if(audioContext.state==="suspended"){
audioContext.resume();
}

isPlaying=true;

const buffer=audioQueue.shift();
const pcmData=new Int16Array(buffer);

const audioBuffer=audioContext.createBuffer(
1,
pcmData.length,
audioContext.sampleRate
);

const channel=audioBuffer.getChannelData(0);

for(let i=0;i<pcmData.length;i++){
channel[i]=pcmData[i]/32768;
}

const source = audioContext.createBufferSource();
currentSource = source;
const analyserSpeak = audioContext.createAnalyser();
analyserSpeak.fftSize = 128;

source.connect(analyserSpeak);
analyserSpeak.connect(audioContext.destination);

// 🔥 ADD THIS (important)
// source.connect(audioContext.destination)

const data = new Uint8Array(analyserSpeak.frequencyBinCount);



/* ===== SET BUFFER ===== */
source.buffer = audioBuffer;

/* ===== SHOW SPEAKING UI ===== */
showWave();
const ring = document.querySelector(".glow-ring");
ring.classList.add("speaking");
/* 🔥 REAL-TIME GLOW */
function animateGlow(){

  // 🔥 STOP previous loop if exists
  if(glowAnimationId){
    cancelAnimationFrame(glowAnimationId);
  }

  function loop(){

    if(!analyserSpeak || !isPlaying){
      glowAnimationId = null;
      return;
    }

    analyserSpeak.getByteFrequencyData(data);

    let sum = 0;
    for(let i=0;i<data.length;i++) sum += data[i];

    let volume = sum / data.length;

    if(ring){
      ring.style.transform = `scale(${1 + volume / 150})`;
      ring.style.opacity = 0.5 + volume / 300;
    }

    glowAnimationId = requestAnimationFrame(loop);
  }

  loop();
}

animateGlow();

// 🔥 ADD THIS
document.querySelector(".glow-ring").classList.add("speaking");

/* ===== WHEN AUDIO ENDS ===== */
source.onended = () => {

  // 🔥 CRITICAL FIX
  if(!isCallActive) return;

  speakingVolume = 0;
  document.querySelector(".glow-ring").classList.remove("speaking");

  playNextChunk();
};

/* ===== START AUDIO ===== */
source.start();

}


// ======================================================
// CLEAR AUDIO QUEUE
// ======================================================


function clearAudioQueue(){
audioQueue=[];
isPlaying=false;
}


// ======================================================
// UI FUNCTIONS
// ======================================================
function showWave(){

  document.getElementById("voice-wave").style.display="flex";
  document.getElementById("bot-status").innerText="AI Speaking...";

  // ALWAYS SHOW AVATAR
  document.getElementById("ai-face").style.display="block";

  // HIDE WAVE
  document.getElementById("mic-wave").style.display="none";
}
function hideWave(){

  const micWave = document.getElementById("mic-wave");

  // ✅ If call ended → RESET UI
  if(!isCallActive){
    document.getElementById("voice-wave").style.display = "none";
    micWave.style.display = "none";
    document.getElementById("bot-status").innerText = "Tap to talk with AI";
    return;
  }

  document.getElementById("voice-wave").style.display = "none";
  document.getElementById("bot-status").innerText = "Listening...";

  micWave.style.display = "block";
  document.getElementById("ai-face").style.display = "block";

  drawWave();
}


// ======================================================
// HELPERS
// ======================================================

function floatTo16BitPCM(input){

const buffer=new ArrayBuffer(input.length*2);
const view=new DataView(buffer);

for(let i=0;i<input.length;i++){
let s=Math.max(-1,Math.min(1,input[i]));
view.setInt16(
i*2,
s<0?s*0x8000:s*0x7fff,
true
);
}

return buffer;

}

function arrayBufferToBase64(buffer){

let binary="";
const bytes=new Uint8Array(buffer);

for(let i=0;i<bytes.byteLength;i++){
binary+=String.fromCharCode(bytes[i]);
}

return btoa(binary);

}

function waitForSocket(){

return new Promise(resolve=>{

const interval=setInterval(()=>{

if(ws && ws.readyState===WebSocket.OPEN){
clearInterval(interval);
resolve();
}

},50);

});

}

function toggleWidget(){

const widget=document.getElementById("ai-widget");

widget.classList.toggle("hidden");

}

})();
