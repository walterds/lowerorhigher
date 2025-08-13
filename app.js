// Game state
const SUITS = ["♠","♥","♦","♣"]; // Unicode suit symbols
const RANKS = ["A","K","Q","J","10","9","8","7","6","5","4","3","2"]; // Ace high
const RANK_VALUE = { "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14 };
const START_BALANCE = 100;
const TARGET_BALANCE = 1000;
const BETS = [1,2,5,10,25,50];

let playerName = "";
let balance = START_BALANCE;
let currentBet = 0;
let deck = [];
let currentCard = null;
let revealedNextCard = null;
let awaitingNextRound = false;

let handsPlayed = 0;
let goalAchieved = false;

// Timer
let startTimeMs = null;
let timerIntervalId = null;

// UI refs
const playerNameBadge = document.getElementById("playerNameBadge");
const balanceEl = document.getElementById("balance");
const chipsEl = document.getElementById("chips");
const currentBetEl = document.getElementById("currentBet");
const currentCardPre = document.getElementById("currentCardPre");
const nextCardPre = document.getElementById("nextCardPre");
const higherBtn = document.getElementById("higherBtn");
const lowerBtn = document.getElementById("lowerBtn");
const tieBtn = document.getElementById("tieBtn");
const resetBtn = document.getElementById("resetBtn");
const nameGate = document.getElementById("nameGate");
const nameInput = document.getElementById("nameInput");
const startBtn = document.getElementById("startBtn");
const outcomeBackdrop = document.getElementById("outcomeBackdrop");
const outcomeTitle = document.getElementById("outcomeTitle");
const outcomeBody = document.getElementById("outcomeBody");
const nextRoundBtn = document.getElementById("nextRoundBtn");
const handsEl = document.getElementById("hands");
const timerEl = document.getElementById("timer");

// Leaderboard refs
const leaderboardBtn = document.getElementById("leaderboardBtn");
const leaderboardBackdrop = document.getElementById("leaderboardBackdrop");
const leaderboardContainer = document.getElementById("leaderboardContainer");
const exportLeaderboardBtn = document.getElementById("exportLeaderboardBtn");
const clearLeaderboardBtn = document.getElementById("clearLeaderboardBtn");
const closeLeaderboardBtn = document.getElementById("closeLeaderboardBtn");

function createDeck(){
  const d = [];
  for(const s of SUITS){
    for(const r of RANKS){
      d.push({ suit:s, rank:r, value:RANK_VALUE[r] });
    }
  }
  for(let i=d.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function drawCard(){
  if(deck.length === 0){
    deck = createDeck();
  }
  return deck.pop();
}

// ---- Improved ASCII renderer ----
function asciiCard(card){
  if(!card){
    return [
      "+-------------+",
      "|             |",
      "|    READY    |",
      "|             |",
      "+-------------+"
    ].join("\n");
  }

  const innerWidth = 13;
  const innerHeight = 13;
  const topBorder = "+-------------+";
  const bottomBorder = "+-------------+";
  const lines = Array.from({length: innerHeight}, () => " ".repeat(innerWidth));

  const rank = card.rank;  // "A","K","Q","J","10"...,"2"
  const suit = card.suit;  // "♠","♥","♦","♣"

  // Corners
  writeAt(lines, 1, 1, rank);
  writeAt(lines, 2, 1, suit);
  writeRight(lines, innerHeight - 2, rank);
  writeRight(lines, innerHeight - 3, suit);

  // Pips / faces
  if(rank === "A"){
    drawAcePip(lines, suit);
  } else if(["J","Q","K"].includes(rank)){
    drawFaceFrame(lines, rank, suit);
  } else {
    const value = RANK_VALUE[rank];
    drawNumberPips(lines, value, suit);
  }

  return [topBorder, ...lines.map(l => "|" + l + "|"), bottomBorder].join("\n");
}

function asciiBack(){
  const innerWidth = 13;
  const innerHeight = 13;
  const topBorder = "+-------------+";
  const bottomBorder = "+-------------+";
  const lines = [];

  for(let r=0; r<innerHeight; r++){
    let row = "";
    for(let c=0; c<innerWidth; c++){
      const isMedallion = (r>=5 && r<=7) && (c>=3 && c<=9);
      if(isMedallion){
        const label = "LOW-HIGH";
        const start = 3;
        const offset = c - start;
        row += label[offset] || " ";
      }else{
        row += ((r + c) % 2 === 0) ? "#" : ":";
      }
    }
    lines.push(row);
  }
  return [topBorder, ...lines.map(l => "|" + l + "|"), bottomBorder].join("\n");
}

// ---- Helpers for ASCII ----
function writeAt(lines, row, col, text){
  const line = lines[row].split("");
  for(let i=0;i<text.length && col+i<line.length;i++){
    line[col+i] = text[i];
  }
  lines[row] = line.join("");
}

function writeRight(lines, row, text){
  const line = lines[row].split("");
  const start = line.length - text.length - 1; // keep a right margin of 1
  for(let i=0;i<text.length;i++){
    const idx = start + i;
    if(idx>=0 && idx<line.length) line[idx] = text[i];
  }
  lines[row] = line.join("");
}

function drawAcePip(lines, suit){
  const centerRow = 6;
  const centerCol = 6;
  const pattern = [
    {row:centerRow-2, count:1},
    {row:centerRow-1, count:3},
    {row:centerRow,   count:5},
    {row:centerRow+1, count:3},
    {row:centerRow+2, count:1},
  ];
  for(const piece of pattern){
    const start = centerCol - Math.floor(piece.count/2);
    for(let i=0;i<piece.count;i++){
      writeAt(lines, piece.row, start + i, suit);
    }
  }
}

function drawFaceFrame(lines, rank, suit){
  // 11-char frame centered horizontally with 1-char padding
  const startCol = 1;
  const frame = [
    ".---------.",
    `|    ${rank.padEnd(2," ")}   |`,
    `|    ${suit}    |`,
    "|         |",
    "|         |",
    "'---------'"
  ];
  const startRow = 4;
  for(let i=0;i<frame.length;i++){
    writeAt(lines, startRow + i, startCol, frame[i]);
  }
}

function drawNumberPips(lines, value, suit){
  const L = 2, M = 6, R = 10;
  const rows = [3,5,6,7,9];
  const positions = [];
  const addPair = (row) => { positions.push([row,L],[row,R]); };
  const addMid  = (row) => { positions.push([row,M]); };

  switch(value){
    case 2:  addMid(rows[0]); addMid(rows[4]); break;
    case 3:  addMid(rows[0]); addMid(rows[2]); addMid(rows[4]); break;
    case 4:  addPair(rows[0]); addPair(rows[4]); break;
    case 5:  addPair(rows[0]); addMid(rows[2]); addPair(rows[4]); break;
    case 6:  addPair(rows[0]); addPair(rows[2]); addPair(rows[4]); break;
    case 7:  addPair(rows[0]); addPair(rows[2]); addPair(rows[4]); addMid(rows[1]); break;
    case 8:  addPair(rows[0]); addPair(rows[1]); addPair(rows[3]); addPair(rows[4]); break;
    case 9:  addPair(rows[0]); addPair(rows[1]); addMid(rows[2]); addPair(rows[3]); addPair(rows[4]); break;
    case 10: addPair(rows[0]); addPair(rows[1]); addPair(rows[2]); addPair(rows[3]); addPair(rows[4]); break;
    default: addMid(rows[2]);
  }
  for(const [r,c] of positions){
    writeAt(lines, r, c, suit);
  }
}

// UI update
function updateChips(){
  chipsEl.innerHTML = "";
  BETS.forEach(amount => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.textContent = "$" + amount;
    const canAfford = amount <= balance;
    btn.disabled = !canAfford;
    if(amount === currentBet) btn.classList.add("active");
    btn.addEventListener("click", () => {
      if(!canAfford) return;
      currentBet = amount;
      updateHUD();
    });
    chipsEl.appendChild(btn);
  });
}

function updateHUD(){
  playerNameBadge.textContent = playerName || "�";
  balanceEl.textContent = "$" + balance;
  currentBetEl.textContent = "$" + (currentBet || 0);
  handsEl.textContent = String(handsPlayed);
  updateChips();

  currentCardPre.textContent = asciiCard(currentCard);
  nextCardPre.textContent = asciiBack();

  const canPlay = !!playerName && !!currentCard && currentBet > 0 && currentBet <= balance && !awaitingNextRound;
  higherBtn.disabled = !canPlay;
  lowerBtn.disabled = !canPlay;
  tieBtn.disabled = !canPlay;

  updateTimerUI();
}

function startRound(){
  if(!currentCard){
    currentCard = drawCard();
  }
  revealedNextCard = null;
  awaitingNextRound = false;
  updateHUD();
}

function showOutcomeModal(title, body){
  outcomeTitle.textContent = title;
  outcomeBody.innerHTML = body;
  outcomeBackdrop.classList.add("open");
}

function closeOutcomeModal(){
  outcomeBackdrop.classList.remove("open");
}

function ensureTimerStarted(){
  if(startTimeMs == null){
    startTimeMs = Date.now();
    timerIntervalId = setInterval(updateTimerUI, 1000);
    updateTimerUI();
  }
}

function stopTimer(){
  if(timerIntervalId){
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function getElapsedMs(){
  if(startTimeMs == null) return 0;
  return Date.now() - startTimeMs;
}

function formatElapsed(ms){
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if(hours > 0){
    return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  }
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

function updateTimerUI(){
  if(!timerEl) return;
  if(startTimeMs == null){
    timerEl.textContent = "00:00";
  } else {
    timerEl.textContent = formatElapsed(getElapsedMs());
  }
}

function handleGuess(direction){ // "higher" | "lower" | "tie"
  if(awaitingNextRound) return;
  if(currentBet <= 0 || currentBet > balance) return;

  if(handsPlayed === 0 && startTimeMs == null){
    ensureTimerStarted();
  }

  handsPlayed += 1;

  revealedNextCard = drawCard();
  nextCardPre.textContent = asciiCard(revealedNextCard);

  const a = currentCard.value;
  const b = revealedNextCard.value;
  let won = false;
  if(direction === "higher") won = b > a;
  else if(direction === "lower") won = b < a;
  else if(direction === "tie") won = b === a;

  const amount = currentBet;
  if(won){
    if(direction === "tie"){
      balance += amount * 3; // tie pays 3x
    } else {
      balance += amount; // correct guess wins bet amount
    }
  }else{
    balance -= amount;
  }

  if(balance >= TARGET_BALANCE){
    goalAchieved = true;
    stopTimer();
  }

  awaitingNextRound = true;

  const dirLabel = direction === "higher" ? "Higher" : direction === "lower" ? "Lower" : "Tie";
  const resultTitle = goalAchieved ? "Goal achieved!" : (won ? "You won!" : "You lost.");
  const delta = won
    ? `<span style="color:${getCssVar('--success')}">+${direction === 'tie' ? '$'+(amount*3) : '$'+amount}</span>`
    : `<span style="color:${getCssVar('--danger')}">-$${amount}</span>`;
  const extraGoal = goalAchieved
    ? `<div style="margin-top:6px"><strong>Target reached:</strong> $${balance} in ${handsPlayed} hands, time ${formatElapsed(getElapsedMs())}.</div>`
    : "";
  const body = `
    <div style="margin-bottom:6px"><strong>${escapeHtml(playerName)}</strong>, you chose <strong>${dirLabel}</strong>.</div>
    <div class="rule" style="margin-bottom:6px">Current: ${cardLabel(currentCard)} ? Next: ${cardLabel(revealedNextCard)}</div>
    <div style="margin-bottom:6px">Result: ${delta}</div>
    <div class="muted">New balance: <strong>$${balance}</strong></div>
    ${extraGoal}
  `;

  showOutcomeModal(resultTitle, body);
  updateHUD();
  if(balance <= 0){
    higherBtn.disabled = true;
    lowerBtn.disabled = true;
    tieBtn.disabled = true;
    stopTimer();
  }
}

function proceedToNext(){
  closeOutcomeModal();

  if (goalAchieved) {
    addLeaderboardEntry({
      name: playerName,
      result: "win",
      hands: handsPlayed,
      finalBalance: balance,
      elapsedMs: startTimeMs == null ? 0 : (Date.now() - startTimeMs),
      dateISO: new Date().toISOString(),
    });
    openLeaderboard();
    higherBtn.disabled = true;
    lowerBtn.disabled = true;
    tieBtn.disabled = true;
    return;
  }

  if (balance <= 0) {
    addLeaderboardEntry({
      name: playerName,
      result: "bust",
      hands: handsPlayed,
      finalBalance: balance,
      elapsedMs: startTimeMs == null ? 0 : (Date.now() - startTimeMs),
      dateISO: new Date().toISOString(),
    });
    openLeaderboard();
    alert("Game over! You're out of funds. Resetting to $100.");
    resetGame();
    return;
  }

  currentCard = revealedNextCard;
  revealedNextCard = null;
  awaitingNextRound = false;
  updateHUD();
}

function cardLabel(c){ return c ? `${c.rank}${c.suit}` : "�"; }
function getCssVar(name){ return getComputedStyle(document.documentElement).getPropertyValue(name) || ""; }
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

function resetGame(){
  balance = START_BALANCE;
  currentBet = 0;
  deck = createDeck();
  currentCard = drawCard();
  revealedNextCard = null;
  awaitingNextRound = false;
  handsPlayed = 0;
  goalAchieved = false;
  stopTimer();
  startTimeMs = null;
  updateHUD();
}

// Leaderboard (localStorage + export)
const LB_KEY = "hl_leaderboard_v1";

function loadLeaderboard(){
  try {
    const raw = localStorage.getItem(LB_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLeaderboard(entries){
  localStorage.setItem(LB_KEY, JSON.stringify(entries));
}

function addLeaderboardEntry(entry){
  const entries = loadLeaderboard();
  entries.push(entry);
  saveLeaderboard(entries);
  renderLeaderboard();
}

function renderLeaderboard(){
  const entries = loadLeaderboard();

  const sorted = entries.slice().sort((a,b) => {
    if (a.result !== b.result) return a.result === "win" ? -1 : 1;
    if (a.result === "win"){
      const aTime = a.elapsedMs ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.elapsedMs ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime; // faster (lower) time first
      return a.hands - b.hands || (a.dateISO < b.dateISO ? -1 : 1);
    }
    // busts
    return b.hands - a.hands || (a.dateISO < b.dateISO ? -1 : 1);
  });

  if (sorted.length === 0){
    leaderboardContainer.innerHTML = `<div class="muted">No results yet. Win $${TARGET_BALANCE} to record a score.</div>`;
    return;
  }

  const lines = [];
  lines.push("Name           | Result | Hands | Final | Time   | Date");
  lines.push("----------------+--------+-------+-------+--------+------------------------");
  for (const e of sorted){
    const name = (e.name || "�").toString().slice(0,14).padEnd(14," ");
    const res  = (e.result === "win" ? "WIN" : "BUST").padEnd(6," ");
    const hands = String(e.hands).padStart(5," ");
    const fin  = ("$" + e.finalBalance).padStart(6," ");
    const time = (e.elapsedMs != null ? formatElapsed(e.elapsedMs) : "--:--").padEnd(6," ");
    const date = new Date(e.dateISO).toLocaleString();
    lines.push(`${name} | ${res} | ${hands} | ${fin} | ${time} | ${date}`);
  }
  leaderboardContainer.innerHTML = `<pre style="margin:0; white-space:pre">${lines.join("\n")}</pre>`;
}

function openLeaderboard(){
  renderLeaderboard();
  leaderboardBackdrop.classList.add("open");
}

function closeLeaderboard(){
  leaderboardBackdrop.classList.remove("open");
}

function exportLeaderboardTxt(){
  const entries = loadLeaderboard();
  const header = "Name | Result | Hands | Final | Time | Date";
  const rows = entries.map(e => {
    const time = e.elapsedMs != null ? formatElapsed(e.elapsedMs) : "--:--";
    return `${e.name} | ${e.result} | ${e.hands} | $${e.finalBalance} | ${time} | ${e.dateISO}`;
  });
  const text = [header, ...rows].join("\n");
  const blob = new Blob([text], {type:"text/plain"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leaderboard.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Wire up
higherBtn.addEventListener("click", () => handleGuess("higher"));
lowerBtn.addEventListener("click", () => handleGuess("lower"));
tieBtn.addEventListener("click", () => handleGuess("tie"));
nextRoundBtn.addEventListener("click", proceedToNext);
outcomeBackdrop.addEventListener("click", (e) => {
  if(e.target === outcomeBackdrop){ proceedToNext(); }
});
resetBtn.addEventListener("click", resetGame);

startBtn.addEventListener("click", () => {
  const val = nameInput.value.trim();
  if(!val){ nameInput.focus(); return; }
  playerName = val;
  nameGate.style.display = "none";
  resetGame();
});
nameInput.addEventListener("keydown", (e) => {
  if(e.key === "Enter"){ startBtn.click(); }
});

leaderboardBtn.addEventListener("click", openLeaderboard);
closeLeaderboardBtn.addEventListener("click", closeLeaderboard);
leaderboardBackdrop.addEventListener("click", (e) => {
  if(e.target === leaderboardBackdrop){ closeLeaderboard(); }
});
exportLeaderboardBtn.addEventListener("click", exportLeaderboardTxt);
clearLeaderboardBtn.addEventListener("click", () => {
  if(confirm("Clear all leaderboard entries?")){
    saveLeaderboard([]);
    renderLeaderboard();
  }
});

// Initialize gate and initial UI
updateChips();
updateHUD();