(function () {

//////////////////////////////////////////////////////////
// CSS
//////////////////////////////////////////////////////////

const css = `
#ai-widget{
position:fixed;
bottom:20px;
right:20px;
width:320px;
background:#1e1e2f;
border-radius:12px;
padding:15px;
color:white;
font-family:Arial;
box-shadow:0 0 20px rgba(0,0,0,.4);
z-index:9999;
}

#ai-header{
font-weight:bold;
margin-bottom:10px;
}

#call-btn{
background:#4CAF50;
border:none;
padding:10px;
width:100%;
border-radius:8px;
cursor:pointer;
color:white;
}

#end-btn{
background:red;
color:white;
margin-left:10px;
padding:10px;
width:100%;
border:none;
border-radius:8px;
cursor:pointer;
}

.hidden{display:none}

#assistant-area{
text-align:center;
margin-bottom:15px;
}

.bot-avatar{
width:60px;
height:60px;
background:#4CAF50;
border-radius:50%;
margin:auto;
margin-bottom:10px;
}

#voice-wave{
display:none;
justify-content:center;
align-items:flex-end;
gap:4px;
height:40px;
margin:10px 0;
}

#voice-wave span{
width:6px;
background:#4CAF50;
border-radius:4px;
animation:wave 1s infinite ease-in-out;
}

#voice-wave span:nth-child(1){height:10px;animation-delay:0s}
#voice-wave span:nth-child(2){height:20px;animation-delay:.2s}
#voice-wave span:nth-child(3){height:30px;animation-delay:.4s}
#voice-wave span:nth-child(4){height:20px;animation-delay:.2s}
#voice-wave span:nth-child(5){height:10px;animation-delay:0s}

@keyframes wave{
0%{transform:scaleY(.4)}
50%{transform:scaleY(1)}
100%{transform:scaleY(.4)}
}

#mic-indicator{
font-size:28px;
margin-top:10px;
text-align:center;
color:#aaa;
}

.mic-active{
color:#4CAF50;
animation:micGlow 1.5s infinite;
}

@keyframes micGlow{
0%{text-shadow:0 0 5px #4CAF50}
50%{text-shadow:0 0 20px #4CAF50}
100%{text-shadow:0 0 5px #4CAF50}
}

#bot-status{
font-size:14px;
}
`;

const style = document.createElement("style");
style.innerHTML = css;
document.head.appendChild(style);

//////////////////////////////////////////////////////////
// HTML
//////////////////////////////////////////////////////////

const widgetHTML = `
<div id="ai-widget">

<div id="ai-header">AI Voice Assistant</div>

<div id="assistant-area" class="hidden">

<div class="bot-avatar"></div>

<div id="voice-wave">
<span></span>
<span></span>
<span></span>
<span></span>
<span></span>
</div>

<div id="bot-status">Listening...</div>

<div id="mic-indicator">🎤</div>

</div>

<button id="call-btn">Start Call</button>
<button id="end-btn" style="display:none;">End Call</button>

</div>
`;

document.body.insertAdjacentHTML("beforeend", widgetHTML);

//////////////////////////////////////////////////////////
// GLOBALS
//////////////////////////////////////////////////////////

let ws;
let audioContext;
let micStream;
let processor;

let isConnected = false;
let isCallActive = false;

let audioQueue = [];
let isPlaying = false;

//////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////

function connectSocket(){

ws = new WebSocket("wss://ivr-widget.onrender.com/browser-call");

ws.onopen = ()=>{
isConnected = true;
};

ws.onclose = ()=>{
isConnected=false;
isCallActive=false;

document.getElementById("call-btn").style.display="inline-block";
document.getElementById("end-btn").style.display="none";
document.getElementById("assistant-area").classList.add("hidden");

hideWave();
};

ws.onmessage = handleServerMessage;

}

//////////////////////////////////////////////////////////
// START CALL
//////////////////////////////////////////////////////////

async function startCall(){

if(isCallActive)return;

if(!ws || ws.readyState!==1){
connectSocket();
await waitForSocket();
}

audioContext=new AudioContext({sampleRate:16000});
await audioContext.resume();

micStream = await navigator.mediaDevices.getUserMedia({
audio:{
echoCancellation:true,
noiseSuppression:true,
autoGainControl:true
}
});

document.getElementById("assistant-area").classList.remove("hidden");
document.getElementById("mic-indicator").classList.add("mic-active");

const source=audioContext.createMediaStreamSource(micStream);

processor=audioContext.createScriptProcessor(4096,1,1);

source.connect(processor);
processor.connect(audioContext.destination);

processor.onaudioprocess=(e)=>{

if(!isConnected)return;

const input=e.inputBuffer.getChannelData(0);
const buffer=floatTo16BitPCM(input);

ws.send(JSON.stringify({
type:"audio",
audio:arrayBufferToBase64(buffer)
}));

};

isCallActive=true;

document.getElementById("call-btn").style.display="none";
document.getElementById("end-btn").style.display="inline-block";

}

//////////////////////////////////////////////////////////
// STOP CALL
//////////////////////////////////////////////////////////

function stopCall(){

if(processor){
processor.disconnect();
processor=null;
}

if(micStream){
micStream.getTracks().forEach(t=>t.stop());
micStream=null;
}

if(audioContext){
audioContext.close();
audioContext=null;
}

if(ws){
ws.close();
ws=null;
}

audioQueue=[];
isPlaying=false;

document.getElementById("assistant-area").classList.add("hidden");
document.getElementById("mic-indicator").classList.remove("mic-active");
document.getElementById("call-btn").style.display="inline-block";
document.getElementById("end-btn").style.display="none";

hideWave();

isCallActive=false;

}

//////////////////////////////////////////////////////////
// SERVER AUDIO
//////////////////////////////////////////////////////////

function handleServerMessage(event){

let data;

try{
data=JSON.parse(event.data);
}catch(e){return;}

if(data.type==="audio"){
playPCM16(data.audio);
}

if(data.type==="clear"){
audioQueue=[];
isPlaying=false;
}

}

//////////////////////////////////////////////////////////
// AUDIO PLAY
//////////////////////////////////////////////////////////

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

if(audioQueue.length===0){
isPlaying=false;
hideWave();
return;
}

isPlaying=true;

const buffer=audioQueue.shift();
const pcmData=new Int16Array(buffer);

const audioBuffer=audioContext.createBuffer(1,pcmData.length,16000);
const channel=audioBuffer.getChannelData(0);

for(let i=0;i<pcmData.length;i++){
channel[i]=pcmData[i]/32768;
}

const source=audioContext.createBufferSource();
source.buffer=audioBuffer;
source.connect(audioContext.destination);

showWave();

source.onended=()=>{
playNextChunk();
};

source.start();

}

//////////////////////////////////////////////////////////
// UI
//////////////////////////////////////////////////////////

function showWave(){
document.getElementById("voice-wave").style.display="flex";
document.getElementById("bot-status").innerText="AI Speaking...";
}

function hideWave(){
document.getElementById("voice-wave").style.display="none";
document.getElementById("bot-status").innerText="Listening...";
}

//////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////

function floatTo16BitPCM(input){

const buffer=new ArrayBuffer(input.length*2);
const view=new DataView(buffer);

for(let i=0;i<input.length;i++){
let s=Math.max(-1,Math.min(1,input[i]));
view.setInt16(i*2,s<0?s*0x8000:s*0x7fff,true);
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

if(ws && ws.readyState===1){
clearInterval(interval);
resolve();
}

},50);

});

}

//////////////////////////////////////////////////////////
// BUTTON EVENTS
//////////////////////////////////////////////////////////

document.getElementById("call-btn").onclick=startCall;
document.getElementById("end-btn").onclick=stopCall;

})();
