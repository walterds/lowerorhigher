const express = require('express');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const LB_FILE = path.join(DATA_DIR, 'leaderboard.ndjson');

app.use(express.json());
app.use(express.static(__dirname));

async function ensureDataFile(){
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try { await fsp.access(LB_FILE, fs.constants.F_OK); } catch { await fsp.writeFile(LB_FILE, ''); }
}

function isValidEntry(e){
  if(!e || typeof e !== 'object') return false;
  const okResult = e.result === 'win' || e.result === 'bust';
  const okName = typeof e.name === 'string' && e.name.length <= 100;
  const okHands = Number.isFinite(e.hands) && e.hands >= 0;
  const okFinal = Number.isFinite(e.finalBalance);
  const okDate = typeof e.dateISO === 'string';
  return okResult && okName && okHands && okFinal && okDate;
}

async function readAllEntries(){
  await ensureDataFile();
  const raw = await fsp.readFile(LB_FILE, 'utf8');
  const lines = raw.split('\n').filter(Boolean);
  const entries = [];
  for(const line of lines){
    try { entries.push(JSON.parse(line)); } catch {}
  }
  return entries;
}

app.get('/api/leaderboard', async (req, res) => {
  try {
    const entries = await readAllEntries();
    res.json(entries);
  } catch (e) {
    res.status(500).json({ error: 'Failed to read leaderboard' });
  }
});

app.post('/api/leaderboard', async (req, res) => {
  try {
    const entry = req.body;
    if(!isValidEntry(entry)) return res.status(400).json({ error: 'Invalid entry' });
    await ensureDataFile();
    await fsp.appendFile(LB_FILE, JSON.stringify(entry) + '\n');
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to append entry' });
  }
});

app.delete('/api/leaderboard', async (req, res) => {
  try {
    await ensureDataFile();
    await fsp.writeFile(LB_FILE, '');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to clear leaderboard' });
  }
});

app.get('/api/leaderboard/export', async (req, res) => {
  try {
    const entries = await readAllEntries();
    const header = 'Name | Result | Hands | Final | Time | Date';
    const rows = entries.map(e => {
      const time = e.elapsedMs != null ? formatElapsed(e.elapsedMs) : '--:--';
      return `${e.name} | ${e.result} | ${e.hands} | $${e.finalBalance} | ${time} | ${e.dateISO}`;
    });
    const text = [header, ...rows].join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="leaderboard.txt"');
    res.send(text);
  } catch (e) {
    res.status(500).json({ error: 'Failed to export leaderboard' });
  }
});

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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});