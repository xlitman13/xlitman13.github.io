import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getDatabase, ref, get, set, update, onValue, remove } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LAST_ROOM_KEY = "yahtzee-live-last-room";
const LAST_NAME_KEY = "yahtzee-live-name";

const categories = [
  { id:"ones", label:"Ones", hint:"Total 1s", section:"upper" },
  { id:"twos", label:"Twos", hint:"Total 2s", section:"upper" },
  { id:"threes", label:"Threes", hint:"Total 3s", section:"upper" },
  { id:"fours", label:"Fours", hint:"Total 4s", section:"upper" },
  { id:"fives", label:"Fives", hint:"Total 5s", section:"upper" },
  { id:"sixes", label:"Sixes", hint:"Total 6s", section:"upper" },
  { id:"threeKind", label:"3 of a Kind", hint:"Total all dice", section:"lower" },
  { id:"fourKind", label:"4 of a Kind", hint:"Total all dice", section:"lower" },
  { id:"fullHouse", label:"Full House", hint:"25 points", section:"lower", choices:[0,25] },
  { id:"smallStraight", label:"Small Straight", hint:"30 points", section:"lower", choices:[0,30] },
  { id:"largeStraight", label:"Large Straight", hint:"40 points", section:"lower", choices:[0,40] },
  { id:"yahtzee", label:"Yahtzee", hint:"50 points", section:"lower", choices:[0,50] },
  { id:"chance", label:"Chance", hint:"Total all dice", section:"lower" },
  { id:"yahtzeeBonus", label:"Yahtzee Bonus", hint:"100 each", section:"lower", bonus:true }
];

const $ = id => document.getElementById(id);
const els = {
  setupWarning:$("setupWarning"), homeView:$("homeView"), lobbyView:$("lobbyView"), gameView:$("gameView"),
  homeName:$("homeName"), roomCodeInput:$("roomCodeInput"), createRoomBtn:$("createRoomBtn"), joinRoomBtn:$("joinRoomBtn"),
  homeError:$("homeError"), lobbyRoomCode:$("lobbyRoomCode"), lobbyPlayers:$("lobbyPlayers"), playerCount:$("playerCount"),
  shareRoomBtn:$("shareRoomBtn"), startGameBtn:$("startGameBtn"), leaveLobbyBtn:$("leaveLobbyBtn"),
  gameRoomCode:$("gameRoomCode"), headerRoom:$("headerRoom"), syncStatus:$("syncStatus"), scoreHead:$("scoreHead"),
  scoreBody:$("scoreBody"), shareGameBtn:$("shareGameBtn"), resetGameBtn:$("resetGameBtn"), leaveGameBtn:$("leaveGameBtn"),
  scoreDialog:$("scoreDialog"), scoreForm:$("scoreForm"), dialogPlayer:$("dialogPlayer"), dialogCategory:$("dialogCategory"),
  quickChoices:$("quickChoices"), scoreInputWrap:$("scoreInputWrap"), scoreInput:$("scoreInput"), clearScoreBtn:$("clearScoreBtn"),
  confirmDialog:$("confirmDialog"), confirmResetBtn:$("confirmResetBtn"), toast:$("toast")
};

let app, auth, db, user = null;
let roomCode = null;
let roomData = null;
let unsubscribeRoom = null;
let editing = null;

function configReady() {
  return firebaseConfig?.apiKey && !String(firebaseConfig.apiKey).includes("PASTE_")
    && firebaseConfig?.databaseURL && !String(firebaseConfig.databaseURL).includes("PASTE_");
}
function cleanName(value) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, 18); }
function cleanCode(value) { return String(value || "").toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6); }
function randomCode() {
  let result = "";
  crypto.getRandomValues(new Uint32Array(6)).forEach(n => result += ROOM_ALPHABET[n % ROOM_ALPHABET.length]);
  return result;
}
function showView(name) {
  els.homeView.hidden = name !== "home";
  els.lobbyView.hidden = name !== "lobby";
  els.gameView.hidden = name !== "game";
  els.headerRoom.hidden = name === "home";
}
function setBusy(button, busy, label) {
  if (!button) return;
  if (busy) { button.dataset.original = button.textContent; button.textContent = label || "Working…"; }
  else if (button.dataset.original) { button.textContent = button.dataset.original; delete button.dataset.original; }
  button.disabled = busy;
}
function toast(message) {
  els.toast.textContent = message; els.toast.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => els.toast.hidden = true, 2200);
}
function friendlyError(error) {
  console.error(error);
  const msg = String(error?.message || error || "");
  if (msg.includes("PERMISSION_DENIED")) return "Firebase blocked that request. Check your Realtime Database rules.";
  if (msg.includes("auth/operation-not-allowed")) return "Enable Anonymous sign-in in Firebase Authentication.";
  if (msg.includes("auth/unauthorized-domain")) return "Add your GitHub Pages domain to Firebase Authentication → Authorized domains.";
  if (msg.toLowerCase().includes("network")) return "Network error. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}
async function ensureAuth() {
  if (user) return user;
  const credential = await signInAnonymously(auth);
  user = credential.user;
  return user;
}
async function generateUniqueRoomCode() {
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) return code;
  }
  throw new Error("Could not generate a unique room code.");
}

async function createRoom() {
  els.homeError.textContent = "";
  const name = cleanName(els.homeName.value);
  if (!name) { els.homeError.textContent = "Enter your name first."; els.homeName.focus(); return; }
  setBusy(els.createRoomBtn, true, "Creating…");
  try {
    await ensureAuth();
    const code = await generateUniqueRoomCode();
    const now = Date.now();
    await set(ref(db, `rooms/${code}`), {
      hostUid: user.uid, createdAt: now, status: "lobby",
      players: { [user.uid]: { name, joinedAt: now, scores: {} } }
    });
    localStorage.setItem(LAST_NAME_KEY, name);
    enterRoom(code);
  } catch (e) { els.homeError.textContent = friendlyError(e); }
  finally { setBusy(els.createRoomBtn, false); }
}

async function joinRoom() {
  els.homeError.textContent = "";
  const name = cleanName(els.homeName.value), code = cleanCode(els.roomCodeInput.value);
  if (!name) { els.homeError.textContent = "Enter your name first."; els.homeName.focus(); return; }
  if (code.length !== 6) { els.homeError.textContent = "Enter the 6-character room code."; els.roomCodeInput.focus(); return; }
  setBusy(els.joinRoomBtn, true, "Joining…");
  try {
    await ensureAuth();
    const roomSnap = await get(ref(db, `rooms/${code}`));
    if (!roomSnap.exists()) throw new Error("ROOM_NOT_FOUND");
    const existing = roomSnap.child(`players/${user.uid}`).val();
    if (!existing) await set(ref(db, `rooms/${code}/players/${user.uid}`), { name, joinedAt: Date.now(), scores: {} });
    else if (existing.name !== name) await update(ref(db, `rooms/${code}/players/${user.uid}`), { name });
    localStorage.setItem(LAST_NAME_KEY, name);
    enterRoom(code);
  } catch (e) {
    els.homeError.textContent = String(e?.message).includes("ROOM_NOT_FOUND")
      ? "That room doesn't exist. Check the code and try again." : friendlyError(e);
  } finally { setBusy(els.joinRoomBtn, false); }
}

function enterRoom(code) {
  roomCode = code;
  localStorage.setItem(LAST_ROOM_KEY, code);
  const url = new URL(location.href); url.searchParams.set("room", code); history.replaceState({}, "", url);
  els.headerRoom.textContent = code; els.lobbyRoomCode.textContent = code; els.gameRoomCode.textContent = code;
  els.syncStatus.textContent = "Connecting…"; els.syncStatus.classList.remove("live");
  if (unsubscribeRoom) unsubscribeRoom();
  unsubscribeRoom = onValue(ref(db, `rooms/${code}`), snapshot => {
    if (!snapshot.exists()) { toast("This room was closed."); leaveRoom(false); return; }
    roomData = snapshot.val(); renderRoom();
  }, error => { els.syncStatus.textContent = "Sync error"; console.error(error); });
}

function renderRoom() {
  if (!roomData || !user) return;
  const isHost = roomData.hostUid === user.uid;
  const players = Object.entries(roomData.players || {}).sort((a,b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
  els.headerRoom.textContent = roomCode;
  els.startGameBtn.hidden = !isHost; els.resetGameBtn.hidden = !isHost;
  els.syncStatus.textContent = "Live"; els.syncStatus.classList.add("live");
  if (roomData.status === "playing") {
    showView("game"); renderScorecard(players, isHost);
  } else {
    showView("lobby");
    els.playerCount.textContent = `${players.length} player${players.length === 1 ? "" : "s"}`;
    els.lobbyPlayers.innerHTML = "";
    players.forEach(([uid, player]) => {
      const row = document.createElement("div"); row.className = "player-row";
      const dot=document.createElement("span"); dot.className="player-dot";
      const name=document.createElement("strong"); name.textContent=player.name || "Player";
      row.append(dot,name);
      if (uid === roomData.hostUid) { const badge=document.createElement("span"); badge.className="host-badge"; badge.textContent="Host"; row.appendChild(badge); }
      if (uid === user.uid) { const badge=document.createElement("span"); badge.className="you-badge"; badge.textContent="You"; row.appendChild(badge); }
      els.lobbyPlayers.appendChild(row);
    });
  }
}

function scoreValue(player,id) { const v=player?.scores?.[id]; return Number.isFinite(v)?v:0; }
function totals(player) {
  const upperIds=["ones","twos","threes","fours","fives","sixes"];
  const lowerIds=["threeKind","fourKind","fullHouse","smallStraight","largeStraight","yahtzee","chance","yahtzeeBonus"];
  const upper=upperIds.reduce((s,id)=>s+scoreValue(player,id),0), bonus=upper>=63?35:0;
  const lower=lowerIds.reduce((s,id)=>s+scoreValue(player,id),0);
  return {upper,bonus,upperTotal:upper+bonus,lower,grand:upper+bonus+lower};
}
function baseRow(label,hint="",className="") {
  const tr=document.createElement("tr"); tr.className=className;
  const td=document.createElement("td"), box=document.createElement("div"); box.className="category"; box.textContent=label;
  if(hint){const small=document.createElement("small");small.textContent=hint;box.appendChild(small)}
  td.appendChild(box); tr.appendChild(td); return tr;
}
function renderScorecard(players,isHost) {
  els.scoreHead.innerHTML=""; els.scoreBody.innerHTML="";
  const hr=document.createElement("tr"), first=document.createElement("th"); first.textContent="Category"; hr.appendChild(first);
  players.forEach(([uid,p])=>{
    const th=document.createElement("th"); th.className="player-head"+(uid===user.uid?" me":""); th.textContent=p.name||"Player";
    const small=document.createElement("span"); small.className="small"; small.textContent=uid===user.uid?"YOU":(uid===roomData.hostUid?"HOST":"");
    th.appendChild(small); hr.appendChild(th);
  }); els.scoreHead.appendChild(hr);

  const addSection=label=>{const tr=baseRow(label,"","section-row");players.forEach(()=>tr.appendChild(document.createElement("td")));els.scoreBody.appendChild(tr)};
  const addSummary=(label,key,cls="summary-row")=>{
    const tr=baseRow(label,"",cls);players.forEach(([uid,p])=>{const td=document.createElement("td");td.textContent=totals(p)[key];if(uid===user.uid)td.classList.add("me");tr.appendChild(td)});els.scoreBody.appendChild(tr)
  };
  const addCategory=category=>{
    const tr=baseRow(category.label,category.hint);
    players.forEach(([uid,p])=>{
      const td=document.createElement("td");td.className="score-cell"+(uid===user.uid?" me":"");
      const btn=document.createElement("button");btn.type="button";btn.className="score-button";
      const raw=p.scores?.[category.id],filled=Number.isFinite(raw);btn.classList.add(filled?"filled":"empty");btn.textContent=filled?raw:"Tap";
      const canEdit=uid===user.uid||isHost;btn.disabled=!canEdit;btn.setAttribute("aria-label",`${p.name}, ${category.label}: ${filled?raw:"empty"}`);
      if(canEdit)btn.addEventListener("click",()=>openScoreDialog(uid,p,category));td.appendChild(btn);tr.appendChild(td)
    });els.scoreBody.appendChild(tr)
  };
  addSection("Upper Section");categories.filter(c=>c.section==="upper").forEach(addCategory);
  addSummary("Upper subtotal","upper");addSummary("Bonus","bonus","summary-row bonus-row");addSummary("Upper total","upperTotal");
  addSection("Lower Section");categories.filter(c=>c.section==="lower").forEach(addCategory);
  addSummary("Lower total","lower");addSummary("Grand total","grand","summary-row grand-row");
}

function openScoreDialog(uid,player,category) {
  editing={uid,categoryId:category.id};els.dialogPlayer.textContent=player.name||"Player";els.dialogCategory.textContent=category.label;
  const current=player.scores?.[category.id];els.scoreInput.value=Number.isFinite(current)?current:"";els.quickChoices.innerHTML="";
  if(category.choices){els.quickChoices.hidden=false;els.scoreInputWrap.hidden=true;category.choices.forEach(v=>addChoice(v,v===0?"Scratch · 0":String(v)))}
  else if(category.bonus){els.quickChoices.hidden=false;els.scoreInputWrap.hidden=false;[0,100,200,300,400].forEach(v=>addChoice(v,String(v)))}
  else{els.quickChoices.hidden=true;els.scoreInputWrap.hidden=false}
  els.scoreDialog.showModal();setTimeout(()=>{if(!els.scoreInputWrap.hidden)els.scoreInput.focus()},40);
}
function addChoice(value,label) {
  const b=document.createElement("button");b.type="button";b.className="quick-choice";b.textContent=label;
  b.addEventListener("click",async()=>{await writeScore(value);els.scoreDialog.close()});els.quickChoices.appendChild(b)
}
async function writeScore(value) {
  if(!editing||!roomCode)return;
  const path=`rooms/${roomCode}/players/${editing.uid}/scores/${editing.categoryId}`;
  try{if(value===null)await remove(ref(db,path));else await set(ref(db,path),Math.max(0,Math.min(1000,Math.floor(Number(value)||0))))}
  catch(e){toast(friendlyError(e))}
}
async function startGame(){try{await set(ref(db,`rooms/${roomCode}/status`),"playing")}catch(e){toast(friendlyError(e))}}
async function resetScores(){
  if(!roomData||roomData.hostUid!==user.uid)return;
  const changes={};Object.keys(roomData.players||{}).forEach(uid=>changes[`rooms/${roomCode}/players/${uid}/scores`]=null);
  changes[`rooms/${roomCode}/status`]="playing";
  try{await update(ref(db),changes);toast("Scores reset")}catch(e){toast(friendlyError(e))}
}
async function shareRoom(){
  const link=new URL(location.href);link.searchParams.set("room",roomCode);const text=`Join my Yahtzee game. Room code: ${roomCode}`;
  try{if(navigator.share)await navigator.share({title:"Family Yahtzee",text,url:link.href});else{await navigator.clipboard.writeText(link.href);toast("Room link copied")}}
  catch(e){if(e?.name!=="AbortError")toast("Could not share the link")}
}
function leaveRoom(removeSelf=true){
  if(unsubscribeRoom){unsubscribeRoom();unsubscribeRoom=null}
  const oldCode=roomCode;roomCode=null;roomData=null;editing=null;localStorage.removeItem(LAST_ROOM_KEY);
  const url=new URL(location.href);url.searchParams.delete("room");history.replaceState({},"",url);showView("home");els.headerRoom.hidden=true;
  if(removeSelf&&oldCode&&user)get(ref(db,`rooms/${oldCode}`)).then(snap=>{
    if(!snap.exists())return;const data=snap.val();
    if(data.hostUid===user.uid)toast("You left. The room is still open.");
    else remove(ref(db,`rooms/${oldCode}/players/${user.uid}`)).catch(()=>{});
  }).catch(()=>{});
}
async function resumeFromLink(){
  const queryCode=cleanCode(new URL(location.href).searchParams.get("room")),savedCode=cleanCode(localStorage.getItem(LAST_ROOM_KEY));
  const code=queryCode||savedCode;if(!code||code.length!==6)return;els.roomCodeInput.value=code;
  const snap=await get(ref(db,`rooms/${code}`));if(!snap.exists())return;
  if(snap.child(`players/${user.uid}`).exists())enterRoom(code);
}

els.createRoomBtn.addEventListener("click",createRoom);
els.joinRoomBtn.addEventListener("click",joinRoom);
els.roomCodeInput.addEventListener("input",()=>{els.roomCodeInput.value=cleanCode(els.roomCodeInput.value)});
els.roomCodeInput.addEventListener("keydown",e=>{if(e.key==="Enter")joinRoom()});
els.shareRoomBtn.addEventListener("click",shareRoom);els.shareGameBtn.addEventListener("click",shareRoom);
els.startGameBtn.addEventListener("click",startGame);els.leaveLobbyBtn.addEventListener("click",()=>leaveRoom(true));els.leaveGameBtn.addEventListener("click",()=>leaveRoom(true));
els.resetGameBtn.addEventListener("click",()=>els.confirmDialog.showModal());els.confirmResetBtn.addEventListener("click",resetScores);
els.clearScoreBtn.addEventListener("click",async()=>{await writeScore(null);els.scoreDialog.close()});
els.scoreForm.addEventListener("submit",async e=>{
  if(e.submitter?.value!=="default")return;e.preventDefault();const category=categories.find(c=>c.id===editing?.categoryId);if(category?.choices)return;
  const raw=els.scoreInput.value.trim();if(raw==="")return;await writeScore(Number(raw));els.scoreDialog.close()
});

async function boot(){
  els.homeName.value=localStorage.getItem(LAST_NAME_KEY)||"";
  const queryCode=cleanCode(new URL(location.href).searchParams.get("room"));if(queryCode)els.roomCodeInput.value=queryCode;
  if(!configReady()){els.setupWarning.hidden=false;els.createRoomBtn.disabled=true;els.joinRoomBtn.disabled=true;return}
  try{
    app=initializeApp(firebaseConfig);auth=getAuth(app);db=getDatabase(app);
    onAuthStateChanged(auth,async current=>{if(current){user=current;try{await resumeFromLink()}catch(e){console.error(e)}}});
    await ensureAuth();
  }catch(e){els.homeError.textContent=friendlyError(e)}
}
boot();
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.error));
