// ---------- Data model ----------
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const STORAGE_KEY = 'cortexa-state-v2';
const SLEEP_GOAL = 7;
const MED_LIMIT = 10;

const $ = id => document.getElementById(id);
const sum = arr => arr.reduce((a, b) => a + b, 0);
const hoursAgo = h => Date.now() - h * 3600e3;
const weekdayIdx = (d = new Date()) => (d.getDay() + 6) % 7;

function dayKey(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysAgoKey(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
}

function demoState() {
  const thisMonth = dayKey().slice(0, 7);
  const medDays = [1, 2, 4, 6, 7, 9, 11]
    .map(daysAgoKey)
    .filter(k => k.startsWith(thisMonth));
  const sleep = [6.8, 7.1, 6.6, 7.4, 8.1, 8.2, 7.6];
  const lastNight = sleep[(weekdayIdx() + 6) % 7];

  return {
    version: 2,
    // Migraines this month grouped by weekday (sums to the monthly total)
    weekdayMigraines: [4, 6, 5, 8, 3, 2, 4],
    pastMonths: [38, 35, 41, 36, 34],
    sleep,
    stress: 25,
    brightLightToday: true,
    triggers: [
      { name: 'Bright Lights', count: 45 },
      { name: 'Loud Noise', count: 31 },
      { name: 'Strong Odors', count: 11 },
      { name: 'Stress', count: 9 },
      { name: 'Poor Sleep', count: 4 }
    ],
    attacks: [
      { ts: hoursAgo(26), intensity: 4, duration: '1–4h', triggers: ['Bright Lights'], med: true },
      { ts: hoursAgo(77), intensity: 7, duration: '4–12h', triggers: ['Bright Lights', 'Poor Sleep'], med: true },
      { ts: hoursAgo(122), intensity: 5, duration: '1–4h', triggers: ['Loud Noise'], med: false },
      { ts: hoursAgo(192), intensity: 8, duration: '12h+', triggers: ['Stress', 'Poor Sleep'], med: true },
      { ts: hoursAgo(243), intensity: 3, duration: '<1h', triggers: ['Strong Odors'], med: false }
    ],
    medDays,
    checkins: {},
    streak: 14,
    lastCheckinDay: daysAgoKey(1),
    lastCheckinTs: hoursAgo(27),
    activity: [
      { text: `Sleep data synced — ${lastNight.toFixed(1)} hrs`, ts: hoursAgo(2), color: '#2196F3' },
      { text: 'Mild headache logged (4/10)', ts: hoursAgo(26), color: '#FF9800' },
      { text: 'Completed daily check-in', ts: hoursAgo(27), color: '#4CAF50' },
      { text: 'Weekly report generated', ts: hoursAgo(30), color: '#9C27B0' }
    ]
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && parsed.version === 2) return parsed;
  } catch (e) { /* storage unavailable or corrupt */ }
  return demoState();
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}

let state = loadState();

// ---------- Derived stats ----------
function stats() {
  const wk = state.weekdayMigraines;
  const sl = state.sleep;
  const monthTotal = sum(wk);
  const peakIdx = wk.indexOf(Math.max(...wk));
  const lowIdx = sl.indexOf(Math.min(...sl));
  const bestIdx = sl.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).slice(0, 2).map(o => o.i).sort((a, b) => a - b);

  // Night i is followed by day i+1
  const afterPoor = [], afterGood = [];
  sl.forEach((h, i) => (h < SLEEP_GOAL ? afterPoor : afterGood).push(wk[(i + 1) % 7]));
  const avg = a => (a.length ? sum(a) / a.length : 0);

  const thisMonth = dayKey().slice(0, 7);
  return {
    monthTotal,
    weeklyAvg: monthTotal / 7,
    peakIdx,
    avgSleep: sum(sl) / sl.length,
    lowIdx,
    bestIdx,
    poorNights: afterPoor.length,
    avgAfterPoor: avg(afterPoor),
    avgAfterGood: avg(afterGood),
    medDaysThisMonth: state.medDays.filter(k => k.startsWith(thisMonth)).length
  };
}

function attacksToday() {
  const today = dayKey();
  return state.attacks.filter(a => dayKey(new Date(a.ts)) === today);
}

function computeRisk() {
  const s = stats();
  const t = weekdayIdx();
  const lastNight = state.sleep[(t + 6) % 7];
  const wk = state.weekdayMigraines;
  const checkin = state.checkins[dayKey()];
  const factors = [];

  if (lastNight < SLEEP_GOAL) {
    factors.push({ label: `Short sleep last night (${lastNight.toFixed(1)}h)`, pts: Math.round((SLEEP_GOAL - lastNight) * 30) + 10, action: 'Aim for 7.5h+ tonight and keep a steady bedtime.' });
  }
  if (wk[t] >= Math.max(...wk) * 0.75) {
    factors.push({ label: `${DAYS[t]} is one of your peak days`, pts: 18, action: 'Plan lighter tasks and take regular breaks today.' });
  }
  if (checkin) {
    const symptomPts = checkin.symptoms.reduce((p, sym) => p + (sym === 'Headache' ? 12 : 7), 0) + checkin.pain * 3;
    if (symptomPts > 0) {
      const names = checkin.symptoms.length ? checkin.symptoms.slice(0, 2).join(', ').toLowerCase() : `pain ${checkin.pain}/10`;
      factors.push({ label: `Symptoms today: ${names}`, pts: symptomPts, action: 'Rest somewhere dark and quiet, drink water, and take your rescue medication early if needed.' });
    }
  }
  if (state.stress > 50) {
    factors.push({ label: 'Elevated stress reading', pts: Math.round((state.stress - 50) * 0.5), action: 'Try a 5-minute breathing exercise.' });
  }
  if (state.brightLightToday) {
    factors.push({ label: 'Bright light exposure detected', pts: 10, action: 'Wear tinted glasses outdoors and lower screen brightness.' });
  }
  const recent = state.attacks.find(a => Date.now() - a.ts < 48 * 3600e3);
  if (recent) {
    factors.push({ label: `Recent migraine (${relTime(recent.ts)})`, pts: 8, action: 'Avoid known triggers while you recover.' });
  }
  if (s.medDaysThisMonth >= MED_LIMIT - 2) {
    factors.push({ label: 'Frequent pain medication use', pts: 6, action: 'Ask your doctor about preventive treatment options.' });
  }

  factors.sort((a, b) => b.pts - a.pts);
  const score = Math.max(3, Math.min(97, 10 + sum(factors.map(f => f.pts))));
  const level = score < 35 ? 'Low' : score < 65 ? 'Moderate' : 'High';
  const color = score < 35 ? '#4CAF50' : score < 65 ? '#FF9800' : '#E53935';
  const action = factors.length ? factors[0].action : 'Keep up your routine — stay hydrated and take screen breaks.';
  return { score, level, color, factors, action };
}

// ---------- Formatting helpers ----------
function relTime(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function stampLabel(ts) {
  const d = new Date(ts);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (dayKey(d) === dayKey()) return `Today, ${time}`;
  if (dayKey(d) === daysAgoKey(1)) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, ${time}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function intensityColor(n) {
  return n <= 3 ? '#4CAF50' : n <= 6 ? '#FF9800' : '#E53935';
}

function monthLabels() {
  const now = new Date();
  const labels = [];
  for (let i = 5; i >= 0; i--) {
    labels.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleString('en-US', { month: 'short' }));
  }
  return labels;
}

function joinDays(idxs) {
  return idxs.map(i => DAYS[i]).join(' & ');
}

// ---------- Navigation ----------
function switchTab(tab) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  $('page-' + tab).classList.remove('hidden');
  $('nav-' + tab).classList.add('active');
  document.querySelector('.content-area').scrollTop = 0;
  if (tab === 'health') setTimeout(drawCharts, 60);
}

function goToCheckin() {
  switchTab('health');
  setTimeout(() => $('checkinCard').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

// ---------- Rendering ----------
function renderAll() {
  renderHome();
  renderHealth();
}

function renderHome() {
  const now = new Date();
  $('homeDate').textContent = `${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · Here's your daily overview.`;

  const risk = computeRisk();
  const circumference = 2 * Math.PI * 50;
  const arc = $('riskArc');
  arc.style.stroke = risk.color;
  arc.style.strokeDasharray = `${(risk.score / 100) * circumference} ${circumference}`;
  $('riskScore').textContent = risk.score;
  $('riskLevel').textContent = `${risk.level} risk`;
  $('riskLevel').style.color = risk.color;
  $('riskFactors').innerHTML = risk.factors.length
    ? risk.factors.slice(0, 2).map(f => `<li>${escapeHtml(f.label)}</li>`).join('')
    : '<li>No strong risk factors today</li>';
  $('riskAction').innerHTML = `<strong>Tip:</strong> ${escapeHtml(risk.action)}`;

  $('healthScore').textContent = `${Math.round(100 - risk.score * 0.5)}/100`;
  $('lastCheckin').textContent = relTime(state.lastCheckinTs);
  $('streakValue').textContent = `${state.streak} day${state.streak === 1 ? '' : 's'}`;

  $('activityList').innerHTML = state.activity.slice(0, 5).map(a => `
    <div class="activity-item">
      <div class="activity-dot" style="background:${a.color};"></div>
      <div class="activity-content">
        <div class="activity-text">${escapeHtml(a.text)}</div>
        <div class="activity-time">${stampLabel(a.ts)}</div>
      </div>
    </div>`).join('');
}

function renderHealth() {
  const s = stats();

  // Migraine status
  const today = attacksToday();
  if (today.length) {
    const peak = Math.max(...today.map(a => a.intensity));
    $('statusIcon').innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#FF9800"/><path d="M12 7v6M12 16.5v.5" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg>';
    $('statusText').innerHTML = `<strong>Migraines Today:</strong> ${today.length} logged · peak ${peak}/10`;
  } else {
    $('statusIcon').innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#4CAF50"/><path d="M8 12l3 3 5-5" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
    $('statusText').innerHTML = '<strong>Migraines Today:</strong> No Current Migraine';
  }

  // Check-in status
  const checkin = state.checkins[dayKey()];
  $('checkinStatus').textContent = checkin ? `Saved ${stampLabel(checkin.ts).replace('Today, ', '')}` : 'Not done yet';
  $('checkinStatus').classList.toggle('done', !!checkin);
  $('saveCheckinBtn').textContent = checkin ? 'Update check-in' : 'Save check-in';

  // Frequency card
  $('weeklyAvg').textContent = s.weeklyAvg.toFixed(1);
  $('monthTotal').textContent = s.monthTotal;
  const p = s.peakIdx;
  const phase = p <= 1 ? 'early in the week' : p <= 4 ? 'midweek' : 'on weekends';
  $('freqInsight').innerHTML = `<strong>Insight:</strong> Migraines spike ${phase} — aim for extra rest on ${DAYS[(p + 6) % 7]}/${DAYS[p]}.`;

  // Sleep card
  $('avgSleep').textContent = s.avgSleep.toFixed(1);
  $('sleepConnDesc').textContent = s.poorNights
    ? `Your data shows more migraines after poor sleep nights — ${s.avgAfterPoor.toFixed(1)} the next day vs ${s.avgAfterGood.toFixed(1)} after good sleep.`
    : 'Every night this week met your goal. Keep it up!';
  $('bestSleepText').innerHTML = `<strong>Best Sleep Days:</strong> ${joinDays(s.bestIdx)} &#8594; Fewer migraines next day`;

  renderTriggers();
  renderInsights(s);
  renderMedication(s);
  renderHistory();
  renderTriggerChips();
  drawCharts();
}

function syncCheckinForm() {
  const checkin = state.checkins[dayKey()];
  document.querySelectorAll('#symptomGrid input').forEach(cb => {
    cb.checked = !!checkin && checkin.symptoms.includes(cb.value);
  });
  $('painSlider').value = checkin ? checkin.pain : 0;
  $('painValue').textContent = $('painSlider').value;
}

function renderTriggers() {
  const list = $('triggersList');
  const total = sum(state.triggers.map(t => t.count)) || 1;
  if (list.children.length !== state.triggers.length) {
    list.innerHTML = state.triggers.map((t, i) => `
      <div class="trigger-row">
        <button class="trigger-add" onclick="logTrigger(${i})" aria-label="Log exposure to ${escapeHtml(t.name)}">+</button>
        <span class="trigger-label">${escapeHtml(t.name)}</span>
        <div class="trigger-bar-container"><div class="trigger-bar" style="width:0%"></div></div>
        <span class="trigger-pct">0%</span>
      </div>`).join('');
  }
  requestAnimationFrame(() => {
    [...list.children].forEach((row, i) => {
      const pct = Math.round((state.triggers[i].count / total) * 100);
      row.querySelector('.trigger-bar').style.width = pct + '%';
      row.querySelector('.trigger-pct').textContent = pct + '%';
    });
  });
}

function sortedTriggers() {
  const total = sum(state.triggers.map(t => t.count)) || 1;
  return state.triggers
    .map(t => ({ name: t.name, pct: Math.round((t.count / total) * 100) }))
    .sort((a, b) => b.pct - a.pct);
}

function renderInsights(s) {
  const [t1, t2, t3] = sortedTriggers();
  const items = [
    { dot: 'cyan', text: `${t1.name} and ${t2.name.toLowerCase()} are linked to your migraines most often (${t1.pct}% and ${t2.pct}%). Reducing these could make the biggest difference.` },
    { dot: 'purple', text: `${DAYS[s.peakIdx]} is your peak day with ${state.weekdayMigraines[s.peakIdx]} migraines this month. It often follows a short night — protect your sleep the evening before.` },
    { dot: 'blue', text: `${t3.pct}% of your migraines are related to ${t3.name.toLowerCase()}. Keeping a short note when it happens can help pinpoint the cause.` }
  ];
  $('insightsList').innerHTML = items.map(i => `
    <div class="insight-item">
      <span class="insight-dot ${i.dot}"></span>
      <p>${escapeHtml(i.text)}</p>
    </div>`).join('');
}

function renderMedication(s) {
  const days = s.medDaysThisMonth;
  const bar = $('medBar');
  $('medDays').textContent = days;
  bar.style.width = Math.min(days / MED_LIMIT, 1) * 100 + '%';
  const note = $('medNote');
  note.className = 'med-note';
  if (days >= MED_LIMIT) {
    bar.style.background = '#E53935';
    note.classList.add('danger');
    note.textContent = `You've used pain medication on ${days} days this month. Using it this often can cause medication-overuse (rebound) headaches — please check in with your doctor.`;
  } else if (days >= MED_LIMIT - 2) {
    bar.style.background = '#FF9800';
    note.classList.add('warn');
    note.textContent = `Getting close: ${MED_LIMIT - days} more day${MED_LIMIT - days === 1 ? '' : 's'} before rebound-headache risk. Ask your doctor about preventive options.`;
  } else {
    bar.style.background = '#14B8A6';
    note.textContent = `Within a safe range. Keeping pain medication under ${MED_LIMIT} days a month helps prevent rebound headaches.`;
  }
  const loggedToday = state.medDays.includes(dayKey());
  $('medTodayBtn').textContent = loggedToday ? 'Logged today' : 'Log today';
  $('medTodayBtn').classList.toggle('active', loggedToday);
}

function renderHistory() {
  const recent = state.attacks.slice(0, 5);
  $('historyCount').textContent = `${state.attacks.length} logged`;
  $('historyList').innerHTML = recent.length ? recent.map(a => `
    <div class="history-item">
      <div class="history-intensity" style="background:${intensityColor(a.intensity)}">${a.intensity}</div>
      <div class="history-info">
        <div class="history-date">${stampLabel(a.ts)}</div>
        <div class="history-meta">${escapeHtml(a.duration)}${a.triggers.length ? ' · ' + escapeHtml(a.triggers.join(', ')) : ''}</div>
      </div>
      ${a.med ? '<span class="history-med" title="Took medication">Rx</span>' : ''}
    </div>`).join('') : '<p class="muted">No migraines logged yet.</p>';
}

// ---------- Charts ----------
const chartUI = { freqMode: 'week', freqSel: null, sleepSel: null };
const FREQ_PAD = { L: 34, R: 6, T: 32, B: 20 };
const SLEEP_PAD = { L: 34, R: 16, T: 32, B: 20 };

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return null;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  return { ctx, w: rect.width, h: rect.height };
}

function drawPill(ctx, w, cx, y, text, bg) {
  ctx.font = '600 9px Inter, sans-serif';
  const pw = ctx.measureText(text).width + 14;
  const ph = 16;
  const x = Math.max(2, Math.min(cx - pw / 2, w - pw - 2));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, pw, ph, 8);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.fillText(text, x + pw / 2, y + 11);
}

function drawGrid(ctx, w, pad, ticks, yFor, fmt) {
  ctx.font = '9px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.lineWidth = 1;
  ticks.forEach(t => {
    const y = yFor(t);
    ctx.strokeStyle = '#E6EAF0';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.L, y);
    ctx.lineTo(w - pad.R, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#9AA5B1';
    ctx.fillText(fmt(t), pad.L - 6, y + 3);
  });
}

function drawCharts() {
  drawFrequencyChart();
  drawSleepChart();
}

function freqSeries() {
  if (chartUI.freqMode === 'month') {
    return { labels: monthLabels(), values: [...state.pastMonths, sum(state.weekdayMigraines)], peakLabel: 'Peak Month' };
  }
  return { labels: DAYS, values: state.weekdayMigraines, peakLabel: 'Peak Day' };
}

function niceAxis(maxV) {
  if (maxV <= 9) return { max: 10, ticks: [0, 3, 6, 10] };
  const step = Math.ceil((maxV * 1.15) / 3 / 5) * 5;
  return { max: step * 3, ticks: [0, step, step * 2, step * 3] };
}

function setFreqMode(mode) {
  chartUI.freqMode = mode;
  chartUI.freqSel = null;
  document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  drawFrequencyChart();
}

function drawFrequencyChart() {
  const canvas = $('frequencyChart');
  const c = canvas && setupCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;
  const pad = FREQ_PAD;
  const { labels, values, peakLabel } = freqSeries();
  const { max, ticks } = niceAxis(Math.max(...values));
  const cw = w - pad.L - pad.R;
  const ch = h - pad.T - pad.B;
  const yFor = v => pad.T + ch - (v / max) * ch;
  const slot = cw / values.length;
  const bw = Math.min(slot * 0.62, 36);
  const bx = i => pad.L + i * slot + (slot - bw) / 2;
  const peak = values.indexOf(Math.max(...values));
  const sel = chartUI.freqSel;

  drawGrid(ctx, w, pad, ticks, yFor, String);

  ctx.save();
  ctx.translate(9, pad.T + ch / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = '8px Inter, sans-serif';
  ctx.fillStyle = '#A0AAB5';
  ctx.fillText('Number of Migraines', 0, 0);
  ctx.restore();

  values.forEach((v, i) => {
    const top = yFor(v);
    const isPeak = i === peak;
    if (v > 0) {
      const g = ctx.createLinearGradient(0, top, 0, pad.T + ch);
      g.addColorStop(0, isPeak ? '#8B5CF6' : '#5B9BF8');
      g.addColorStop(1, isPeak ? '#6D28D9' : '#2F6FE0');
      ctx.fillStyle = g;
      ctx.globalAlpha = sel === null || sel === i ? 1 : 0.45;
      ctx.beginPath();
      ctx.roundRect(bx(i), top, bw, pad.T + ch - top, [5, 5, 0, 0]);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#1a1a2e';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(v), bx(i) + bw / 2, top - 5);
    ctx.fillStyle = sel === i ? '#1a1a2e' : '#8A96A3';
    ctx.font = (sel === i ? '600 ' : '') + '9px Inter, sans-serif';
    ctx.fillText(labels[i], bx(i) + bw / 2, h - 5);
  });

  if (sel !== null) {
    const v = values[sel];
    drawPill(ctx, w, bx(sel) + bw / 2, yFor(v) - 31, `${labels[sel]}: ${v} migraine${v === 1 ? '' : 's'}`, '#1a1a2e');
  } else {
    drawPill(ctx, w, bx(peak) + bw / 2, yFor(values[peak]) - 31, peakLabel, '#7C3AED');
  }
}

function sleepPoint(i, w, h) {
  const pad = SLEEP_PAD;
  const cw = w - pad.L - pad.R - 12;
  const ch = h - pad.T - pad.B;
  const v = Math.min(Math.max(state.sleep[i], 6), 9);
  return { x: pad.L + 6 + (i / 6) * cw, y: pad.T + ch - ((v - 6) / 3) * ch };
}

function drawSleepChart() {
  const canvas = $('sleepChart');
  const c = canvas && setupCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;
  const pad = SLEEP_PAD;
  const ch = h - pad.T - pad.B;
  const yFor = v => pad.T + ch - ((v - 6) / 3) * ch;
  const data = state.sleep;
  const pts = data.map((_, i) => sleepPoint(i, w, h));
  const low = stats().lowIdx;
  const sel = chartUI.sleepSel;
  const base = pad.T + ch;

  drawGrid(ctx, w, pad, [6, 6.75, 7.5, 8.25, 9], yFor, t => String(t));
  ctx.fillStyle = '#9AA5B1';
  ctx.textAlign = 'left';
  ctx.fillText('h', 4, yFor(9) + 3);

  const tracePath = () => {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const xm = (pts[i - 1].x + pts[i].x) / 2;
      ctx.bezierCurveTo(xm, pts[i - 1].y, xm, pts[i].y, pts[i].x, pts[i].y);
    }
  };

  const fill = ctx.createLinearGradient(0, pad.T, 0, base);
  fill.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
  fill.addColorStop(1, 'rgba(139, 92, 246, 0.02)');
  ctx.beginPath();
  tracePath();
  ctx.lineTo(pts[pts.length - 1].x, base);
  ctx.lineTo(pts[0].x, base);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  tracePath();
  ctx.strokeStyle = '#8B5CF6';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  pts.forEach((p, i) => {
    const color = i === low ? '#F97316' : '#8B5CF6';
    ctx.beginPath();
    ctx.arc(p.x, p.y, sel === i ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'white';
    ctx.stroke();

    if (i !== low || sel !== null) {
      ctx.fillStyle = color;
      ctx.font = '600 10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(data[i]), p.x, p.y - 10);
    }

    ctx.fillStyle = sel === i ? '#1a1a2e' : '#8A96A3';
    ctx.font = (sel === i ? '600 ' : '') + '9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(DAYS[i], p.x, h - 5);
  });

  if (sel !== null) {
    const note = data[sel] < SLEEP_GOAL ? ' · below goal' : '';
    drawPill(ctx, w, pts[sel].x, pts[sel].y - 34, `${DAYS[sel]}: ${data[sel]}h${note}`, '#1a1a2e');
  } else {
    drawPill(ctx, w, pts[low].x, pts[low].y - 26, 'Lowest', '#F97316');
  }
}

function setupChartTaps() {
  $('frequencyChart').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    const n = freqSeries().values.length;
    const i = Math.floor((e.clientX - r.left - FREQ_PAD.L) / ((r.width - FREQ_PAD.L - FREQ_PAD.R) / n));
    chartUI.freqSel = i >= 0 && i < n && i !== chartUI.freqSel ? i : null;
    drawFrequencyChart();
  });
  $('sleepChart').addEventListener('click', e => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    let best = 0;
    state.sleep.forEach((_, i) => {
      if (Math.abs(sleepPoint(i, r.width, r.height).x - x) < Math.abs(sleepPoint(best, r.width, r.height).x - x)) best = i;
    });
    chartUI.sleepSel = best === chartUI.sleepSel ? null : best;
    drawSleepChart();
  });
}

// ---------- Actions ----------
function addActivity(text, color) {
  state.activity.unshift({ text, ts: Date.now(), color });
  state.activity = state.activity.slice(0, 12);
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function saveCheckin() {
  const symptoms = [...document.querySelectorAll('#symptomGrid input:checked')].map(cb => cb.value);
  const pain = Number($('painSlider').value);
  const key = dayKey();
  const first = !state.checkins[key];
  state.checkins[key] = { symptoms, pain, ts: Date.now() };
  if (first) {
    state.streak = state.lastCheckinDay === daysAgoKey(1) ? state.streak + 1 : 1;
    state.lastCheckinDay = key;
  }
  state.lastCheckinTs = Date.now();
  addActivity(first ? 'Completed daily check-in' : 'Updated daily check-in', '#4CAF50');
  saveState();
  renderAll();
  const risk = computeRisk();
  toast(first ? `Check-in saved · ${state.streak}-day streak · ${risk.level} risk today` : `Check-in updated · ${risk.level} risk today`);
}

function logTrigger(i) {
  const t = state.triggers[i];
  t.count++;
  addActivity(`Trigger exposure: ${t.name}`, '#26C6DA');
  saveState();
  renderTriggers();
  renderInsights(stats());
  renderHome();
  toast(`${t.name} exposure logged`);
}

function toggleMedToday() {
  const key = dayKey();
  const idx = state.medDays.indexOf(key);
  if (idx >= 0) {
    state.medDays.splice(idx, 1);
    toast('Removed today\'s medication entry');
  } else {
    state.medDays.push(key);
    addActivity('Pain medication logged', '#14B8A6');
    toast('Medication logged for today');
  }
  saveState();
  renderAll();
}

// Bottom sheet
function renderTriggerChips() {
  $('triggerChips').innerHTML = state.triggers
    .map(t => `<button class="chip" data-value="${escapeHtml(t.name)}">${escapeHtml(t.name)}</button>`)
    .join('');
}

function openSheet() {
  $('intensitySlider').value = 5;
  $('intensityValue').textContent = '5';
  $('medTaken').checked = false;
  document.querySelectorAll('#triggerChips .chip').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('#durationChips .chip').forEach(c => c.classList.toggle('selected', c.dataset.value === '1–4h'));
  $('sheetBackdrop').classList.add('open');
  $('logSheet').classList.add('open');
}

function closeSheet() {
  $('sheetBackdrop').classList.remove('open');
  $('logSheet').classList.remove('open');
}

function saveMigraine() {
  const intensity = Number($('intensitySlider').value);
  const durationChip = document.querySelector('#durationChips .chip.selected');
  const duration = durationChip ? durationChip.dataset.value : '1–4h';
  const triggers = [...document.querySelectorAll('#triggerChips .chip.selected')].map(c => c.dataset.value);
  const med = $('medTaken').checked;

  state.attacks.unshift({ ts: Date.now(), intensity, duration, triggers, med });
  state.weekdayMigraines[weekdayIdx()]++;
  triggers.forEach(name => {
    const t = state.triggers.find(tr => tr.name === name);
    if (t) t.count++;
  });
  if (med && !state.medDays.includes(dayKey())) state.medDays.push(dayKey());
  addActivity(`Migraine logged (${intensity}/10${triggers.length ? ' · ' + triggers[0] : ''})`, '#FF9800');

  saveState();
  closeSheet();
  renderAll();
  toast('Migraine logged. Rest up, we\'ll track the pattern.');
}

function setupChips() {
  document.querySelectorAll('.chip-group').forEach(group => {
    group.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      if (group.dataset.single) {
        group.querySelectorAll('.chip').forEach(c => c.classList.toggle('selected', c === chip));
      } else {
        chip.classList.toggle('selected');
      }
    });
  });
}

// Doctor report
function openReport() {
  const s = stats();
  const thirty = state.attacks.filter(a => Date.now() - a.ts < 30 * 24 * 3600e3);
  const avgIntensity = thirty.length ? sum(thirty.map(a => a.intensity)) / thirty.length : 0;
  const tops = sortedTriggers().slice(0, 3);

  $('reportMeta').textContent = `Patient: Jake · Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  const rows = [
    ['Migraines this month', `${s.monthTotal} (avg ${s.weeklyAvg.toFixed(1)} per weekday)`],
    ['Most affected day', `${DAYS[s.peakIdx]} (${state.weekdayMigraines[s.peakIdx]} this month)`],
    ['Average intensity (logged, 30 days)', thirty.length ? `${avgIntensity.toFixed(1)} / 10 across ${thirty.length} logs` : 'No logs'],
    ['Top triggers', tops.map(t => `${t.name} ${t.pct}%`).join(', ')],
    ['Average sleep (7 days)', `${s.avgSleep.toFixed(1)} h · ${s.poorNights} night${s.poorNights === 1 ? '' : 's'} under ${SLEEP_GOAL} h`],
    ['Sleep link', `${s.avgAfterPoor.toFixed(1)} migraines after short nights vs ${s.avgAfterGood.toFixed(1)} after good nights`],
    ['Pain-medication days this month', `${s.medDaysThisMonth} (overuse threshold ${MED_LIMIT})`],
    ['Daily check-in streak', `${state.streak} days`]
  ];
  const attackRows = state.attacks.slice(0, 8).map(a => `
    <tr><td>${stampLabel(a.ts)}</td><td>${a.intensity}/10</td><td>${escapeHtml(a.duration)}</td><td>${escapeHtml(a.triggers.join(', ') || '—')}</td><td>${a.med ? 'Yes' : 'No'}</td></tr>`).join('');

  $('reportBody').innerHTML = `
    <table class="report-table">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${escapeHtml(v)}</td></tr>`).join('')}</table>
    <h3 class="report-section">Recent migraine log</h3>
    <table class="report-table log">
      <tr><th>When</th><th>Intensity</th><th>Duration</th><th>Triggers</th><th>Meds</th></tr>
      ${attackRows}
    </table>`;
  $('reportOverlay').hidden = false;
}

function closeReport() {
  $('reportOverlay').hidden = true;
}

function resetDemo() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  state = demoState();
  closeReport();
  syncCheckinForm();
  renderAll();
  toast('Demo data restored');
}

// ---------- Chat ----------
function chatReply(text) {
  const q = text.toLowerCase();
  const s = stats();
  const risk = computeRisk();
  const tops = sortedTriggers();

  if (/risk|forecast|today/.test(q)) {
    const list = risk.factors.length ? risk.factors.slice(0, 3).map(f => '• ' + f.label).join('\n') : '• No strong risk factors right now';
    return `Your migraine risk today is <b>${risk.level} (${risk.score}/100)</b>.\n\nWhat's driving it:\n${list}\n\nSuggestion: ${risk.action}`;
  }
  if (/sleep.*(migraine|headache|link|connect)|(migraine|headache).*sleep|connection|correlat/.test(q)) {
    return `There's a clear link in your data. After nights under ${SLEEP_GOAL}h you averaged <b>${s.avgAfterPoor.toFixed(1)} migraines</b> the next day, compared with <b>${s.avgAfterGood.toFixed(1)}</b> after good sleep.\n\nYour best nights were ${joinDays(s.bestIdx)}, and your shortest was ${DAYS[s.lowIdx]} (${state.sleep[s.lowIdx]}h), right before your ${DAYS[s.peakIdx]} peak. Protecting sleep midweek could help the most.`;
  }
  if (/sleep/.test(q)) {
    return `You're averaging <b>${s.avgSleep.toFixed(1)} hours</b> a night, inside your 7–9h goal. Best nights: ${joinDays(s.bestIdx)}. Lowest: ${DAYS[s.lowIdx]} at ${state.sleep[s.lowIdx]}h. ${s.poorNights} night${s.poorNights === 1 ? ' was' : 's were'} under 7h. A consistent bedtime is the easiest win.`;
  }
  if (/medic|pill|ibuprofen|triptan|painkiller|rebound/.test(q)) {
    return `You've taken pain medication on <b>${s.medDaysThisMonth} day${s.medDaysThisMonth === 1 ? '' : 's'}</b> this month. Staying under ${MED_LIMIT} days a month helps avoid rebound headaches. ${s.medDaysThisMonth >= MED_LIMIT - 2 ? 'You\'re getting close, so it may be worth asking your doctor about preventive treatment.' : 'You\'re in a safe range.'}`;
  }
  if (/prevent|tip|recommend|help/.test(q)) {
    return `Based on your data, here's what should help most:\n\n1. ${tops[0].name} (${tops[0].pct}%): tinted glasses and lower screen brightness\n2. ${tops[1].name} (${tops[1].pct}%): noise-cancelling headphones in busy places\n3. Sleep: keep ${DAYS[(s.peakIdx + 6) % 7]} night at 7.5h+ before your ${DAYS[s.peakIdx]} peak\n4. Medication: keep pain-relief days under ${MED_LIMIT} a month\n5. Keep your ${state.streak}-day check-in streak going, it powers your forecast`;
  }
  if (/report|weekly|monthly|summary|doctor/.test(q)) {
    return `Here's your monthly summary:\n\n• Migraines this month: ${s.monthTotal}\n• Peak day: ${DAYS[s.peakIdx]}\n• Top trigger: ${tops[0].name} (${tops[0].pct}%)\n• Average sleep: ${s.avgSleep.toFixed(1)} hrs/night\n• Pain-medication days: ${s.medDaysThisMonth}\n• Check-in streak: ${state.streak} days\n\nTap <b>Share with my doctor</b> on the Health tab to print this as a report.`;
  }
  if (/trigger/.test(q)) {
    return `Your top triggers are ${tops.slice(0, 4).map(t => `${t.name} (${t.pct}%)`).join(', ')}. Tap + on the Health tab whenever you're exposed so the analysis stays accurate.`;
  }
  if (/migraine|headache|attack/.test(q)) {
    const last = state.attacks[0];
    return `You've had ${s.monthTotal} migraines this month, most often on ${DAYS[s.peakIdx]}s. ${last ? `Your last one was ${stampLabel(last.ts).toLowerCase()} at ${last.intensity}/10.` : ''} You can log a new one from the Home screen.`;
  }
  if (/^(hi|hello|hey)\b/.test(q)) {
    return `Hi Jake! Your risk today is ${risk.level.toLowerCase()}. Ask me about your risk, sleep, triggers, medication, or a summary for your doctor.`;
  }
  return 'I can help with your migraine risk today, the sleep-migraine link, triggers, medication use, and prevention tips. What would you like to explore?';
}

function sendMessage() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text) return;
  addUserMessage(text);
  input.value = '';
  setTimeout(() => addBotMessage(chatReply(text)), 700);
}

function sendSuggestion(btn) {
  const text = btn.textContent;
  addUserMessage(text);
  btn.style.opacity = '0.5';
  btn.style.pointerEvents = 'none';
  setTimeout(() => addBotMessage(chatReply(text)), 700);
}

function addUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'chat-message user';
  div.innerHTML = `<div class="chat-bubble user-bubble">${escapeHtml(text)}</div>`;
  $('chatContainer').appendChild(div);
  scrollChat();
}

function addBotMessage(html) {
  const div = document.createElement('div');
  div.className = 'chat-message bot';
  div.innerHTML = `
    <div class="chat-avatar bot-avatar">
      <svg width="20" height="20" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#4A90D9" opacity="0.2"/><path d="M18 8c-3.9 0-7 3.1-7 7 0 2.4 1.2 4.5 3 5.8V26c0 .6.4 1 1 1h6c.6 0 1-.4 1-1v-5.2c1.8-1.3 3-3.4 3-5.8 0-3.9-3.1-7-7-7z" fill="none" stroke="#4A90D9" stroke-width="1.5"/></svg>
    </div>
    <div class="chat-bubble bot-bubble">${html.replace(/\n/g, '<br>')}</div>`;
  $('chatContainer').appendChild(div);
  scrollChat();
}

function scrollChat() {
  const area = document.querySelector('.content-area');
  setTimeout(() => (area.scrollTop = area.scrollHeight), 50);
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.checkbox-item input').forEach(cb => {
    cb.addEventListener('change', function () {
      this.parentElement.style.transform = 'scale(0.95)';
      setTimeout(() => (this.parentElement.style.transform = 'scale(1)'), 150);
    });
  });
  $('painSlider').addEventListener('input', e => ($('painValue').textContent = e.target.value));
  $('intensitySlider').addEventListener('input', e => ($('intensityValue').textContent = e.target.value));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSheet(); closeReport(); }
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawCharts, 150);
  });
  if (document.fonts) document.fonts.ready.then(drawCharts);

  setupChips();
  setupChartTaps();
  syncCheckinForm();
  renderAll();
  switchTab('home');
});
