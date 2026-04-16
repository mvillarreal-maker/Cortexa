// Tab navigation
function switchTab(tab) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + tab).classList.remove('hidden');
  document.getElementById('nav-' + tab).classList.add('active');
  document.querySelector('.content-area').scrollTop = 0;

  // Draw charts when switching to health tab
  if (tab === 'health') {
    setTimeout(drawCharts, 100);
  }
}

// Draw mini charts on health page
function drawCharts() {
  drawFrequencyChart();
  drawSleepChart();
}

function drawFrequencyChart() {
  const canvas = document.getElementById('frequencyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data = [4, 6, 5, 8, 3, 2, 4];
  const peakIdx = 3;
  const maxVal = 10;
  const padLeft = 38, padRight = 12, padTop = 30, padBottom = 24;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  // Y-axis label
  ctx.save();
  ctx.translate(10, padTop + chartH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#888';
  ctx.font = '9px Inter';
  ctx.textAlign = 'center';
  ctx.fillText('Number of Migraines', 0, 0);
  ctx.restore();

  // Gridlines and Y labels
  ctx.font = '10px Inter';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#999';
  for (let v = 0; v <= maxVal; v += 2) {
    const y = padTop + chartH - (v / maxVal) * chartH;
    ctx.strokeStyle = '#EEF1F5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();
    ctx.fillText(v.toString(), padLeft - 6, y + 3);
  }

  // Bars
  const barGap = chartW / days.length;
  const barWidth = barGap * 0.55;

  data.forEach((val, i) => {
    const cx = padLeft + barGap * i + barGap / 2;
    const x = cx - barWidth / 2;
    const barH = (val / maxVal) * chartH;
    const y = padTop + chartH - barH;

    const isPeak = i === peakIdx;
    const grad = ctx.createLinearGradient(x, y, x, padTop + chartH);
    if (isPeak) {
      grad.addColorStop(0, '#8B5CF6');
      grad.addColorStop(1, '#6D3FCF');
    } else {
      grad.addColorStop(0, '#5B9AE8');
      grad.addColorStop(1, '#3A6EBF');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
    ctx.fill();

    // Value label on top
    ctx.fillStyle = isPeak ? '#7B4FA0' : '#3A6EBF';
    ctx.font = isPeak ? 'bold 11px Inter' : '11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(val.toString(), cx, y - 6);

    // Peak Day label
    if (isPeak) {
      const labelW = 60, labelH = 18;
      const lx = cx - labelW / 2, ly = y - 28;
      ctx.fillStyle = '#F0EBFF';
      ctx.beginPath();
      ctx.roundRect(lx, ly, labelW, labelH, 9);
      ctx.fill();
      ctx.fillStyle = '#7B4FA0';
      ctx.font = 'bold 10px Inter';
      ctx.fillText('Peak Day', cx, ly + 13);
    }

    // Day label
    ctx.fillStyle = '#777';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(days[i], cx, h - 6);
  });
}

function drawSleepChart() {
  const canvas = document.getElementById('sleepChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data = [6.8, 7.1, 6.5, 7.0, 7.8, 8.2, 7.9];
  const lowestIdx = 2;
  const minY = 6, maxY = 9;
  const padLeft = 32, padRight = 12, padTop = 20, padBottom = 24;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;

  // Gridlines and Y labels
  ctx.font = '10px Inter';
  ctx.textAlign = 'right';
  for (let v = minY; v <= maxY; v++) {
    const y = padTop + chartH - ((v - minY) / (maxY - minY)) * chartH;
    ctx.strokeStyle = '#EEF1F5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();
    ctx.fillStyle = '#999';
    ctx.fillText(v + ' h', padLeft - 6, y + 3);
  }

  // Compute points
  const gap = chartW / (days.length - 1);
  const points = data.map((val, i) => ({
    x: padLeft + gap * i,
    y: padTop + chartH - ((val - minY) / (maxY - minY)) * chartH,
    val
  }));

  // Fill area under line
  ctx.beginPath();
  ctx.moveTo(points[0].x, padTop + chartH);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, padTop + chartH);
  ctx.closePath();
  const areaGrad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
  areaGrad.addColorStop(0, 'rgba(107, 79, 160, 0.15)');
  areaGrad.addColorStop(1, 'rgba(107, 79, 160, 0.02)');
  ctx.fillStyle = areaGrad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.strokeStyle = '#6B4FA0';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Dots and labels
  points.forEach((p, i) => {
    const isLowest = i === lowestIdx;

    // Dot
    ctx.beginPath();
    ctx.arc(p.x, p.y, isLowest ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isLowest ? '#FF9800' : '#6B4FA0';
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Value label
    ctx.fillStyle = isLowest ? '#E65100' : '#6B4FA0';
    ctx.font = 'bold 10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(p.val.toFixed(1), p.x, p.y - 12);

    // "Lowest" badge
    if (isLowest) {
      const badgeW = 48, badgeH = 16;
      const bx = p.x - badgeW / 2, by = p.y - 32;
      ctx.fillStyle = '#FFF3E0';
      ctx.beginPath();
      ctx.roundRect(bx, by, badgeW, badgeH, 8);
      ctx.fill();
      ctx.fillStyle = '#E65100';
      ctx.font = 'bold 9px Inter';
      ctx.fillText('Lowest', p.x, by + 12);
    }

    // Day label
    ctx.fillStyle = '#777';
    ctx.font = '10px Inter';
    ctx.fillText(days[i], p.x, h - 6);
  });
}

// Chat functionality
const botResponses = {
  "How's my sleep?": "Your average sleep this week is 7.2 hours per night, which is within a healthy range. Your best night was Tuesday at 8.2 hours. I'd recommend maintaining a consistent bedtime to further improve your sleep quality.",
  "Prevention tips": "Based on your trigger data, here are my top recommendations:\n\n1. Wear blue-light filtering glasses in bright environments\n2. Use noise-cancelling headphones in loud settings\n3. Keep a scent diary to identify problematic odors\n4. Continue your stress-reduction exercises — they're working!\n5. Maintain your 7+ hours sleep routine",
  "Weekly report": "Here's your weekly summary:\n\n- Migraines this week: 3 (down from 5 last week)\n- Most common trigger: Bright lights (45%)\n- Average sleep: 7.2 hrs/night\n- Stress level trend: Decreasing\n- Check-in streak: 14 days\n\nGreat improvement! Keep up the good work, Jake."
};

function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  addUserMessage(text);
  input.value = '';

  setTimeout(() => {
    const response = generateResponse(text);
    addBotMessage(response);
  }, 800);
}

function sendSuggestion(btn) {
  const text = btn.textContent;
  addUserMessage(text);

  // Hide used suggestion
  btn.style.opacity = '0.5';
  btn.style.pointerEvents = 'none';

  setTimeout(() => {
    const response = botResponses[text] || generateResponse(text);
    addBotMessage(response);
  }, 800);
}

function addUserMessage(text) {
  const container = document.getElementById('chatContainer');
  const div = document.createElement('div');
  div.className = 'chat-message user';
  div.innerHTML = `<div class="chat-bubble user-bubble">${escapeHtml(text)}</div>`;
  container.appendChild(div);
  scrollChat();
}

function addBotMessage(text) {
  const container = document.getElementById('chatContainer');
  const div = document.createElement('div');
  div.className = 'chat-message bot';
  div.innerHTML = `
    <div class="chat-avatar bot-avatar">
      <svg width="20" height="20" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16" fill="#4A90D9" opacity="0.2"/><path d="M18 8c-3.9 0-7 3.1-7 7 0 2.4 1.2 4.5 3 5.8V26c0 .6.4 1 1 1h6c.6 0 1-.4 1-1v-5.2c1.8-1.3 3-3.4 3-5.8 0-3.9-3.1-7-7-7z" fill="none" stroke="#4A90D9" stroke-width="1.5"/></svg>
    </div>
    <div class="chat-bubble bot-bubble">${text.replace(/\n/g, '<br>')}</div>`;
  container.appendChild(div);
  scrollChat();
}

function generateResponse(text) {
  const lower = text.toLowerCase();
  if (lower.includes('sleep')) return botResponses["How's my sleep?"];
  if (lower.includes('prevent') || lower.includes('tip') || lower.includes('recommend')) return botResponses["Prevention tips"];
  if (lower.includes('report') || lower.includes('weekly') || lower.includes('summary')) return botResponses["Weekly report"];
  if (lower.includes('trigger')) return "Your top triggers are Bright Lights (45%), Loud Noise (31%), Strong Odors (11%), and Stress (9%). Bright lights have been your most consistent trigger over the past 3 months.";
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) return "Hi Jake! How can I help you today? I can discuss your migraine patterns, triggers, sleep data, or provide health recommendations.";
  if (lower.includes('headache') || lower.includes('migraine')) return "I see you've had 3 migraines this week, which is an improvement from last week's 5. The most recent one was associated with bright light exposure. Would you like tips on managing this trigger?";
  return "I can help you with information about your migraine triggers, sleep patterns, health trends, and prevention strategies. What specific aspect would you like to explore?";
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function scrollChat() {
  const area = document.querySelector('.content-area');
  setTimeout(() => area.scrollTop = area.scrollHeight, 50);
}

// Checkbox interaction sounds (visual feedback)
document.querySelectorAll('.checkbox-item input').forEach(cb => {
  cb.addEventListener('change', function() {
    this.parentElement.style.transform = 'scale(0.95)';
    setTimeout(() => this.parentElement.style.transform = 'scale(1)', 150);
  });
});

// Initialize - start on home page
document.addEventListener('DOMContentLoaded', () => {
  switchTab('home');
});
