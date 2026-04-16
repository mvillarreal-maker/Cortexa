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

  const data = [5, 7, 4, 7, 3, 6];
  const barWidth = w / (data.length * 2);
  const maxVal = 8;

  data.forEach((val, i) => {
    const x = i * (w / data.length) + barWidth / 2;
    const barH = (val / maxVal) * (h - 10);

    const grad = ctx.createLinearGradient(x, h - barH, x, h);
    grad.addColorStop(0, '#4A90D9');
    grad.addColorStop(1, '#2E5FA1');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, h - barH, barWidth, barH, [3, 3, 0, 0]);
    ctx.fill();
  });

  // Y-axis labels
  ctx.fillStyle = '#999';
  ctx.font = '9px Inter';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 7; i += 7) {
    ctx.fillText(i.toString(), w - 2, h - (i / maxVal) * (h - 10) + 3);
  }
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

  const data = [6.5, 7.8, 7.0, 8.2, 6.8, 7.5, 7.2];
  const barWidth = w / (data.length * 1.8);
  const maxVal = 10;

  data.forEach((val, i) => {
    const x = i * (w / data.length) + barWidth * 0.3;
    const barH = (val / maxVal) * (h - 10);

    const alpha = 0.4 + (val / maxVal) * 0.6;
    ctx.fillStyle = `rgba(74, 144, 217, ${alpha})`;
    ctx.beginPath();
    ctx.roundRect(x, h - barH, barWidth, barH, [3, 3, 0, 0]);
    ctx.fill();
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
