/* ==========================================
   AI SMART TEACHER — script.js
   ========================================== */

const API_URL = "https://api.anthropic.com/v1/messages";
const API_KEY = "PASTE_API_KEY_HERE"; // ← вставь свой ключ

// ===== STATE =====
let state = {
  xp: 0,
  level: 1,
  rank: "Новичок",
  streak: 0,
  requests: 5,
  isPremium: false,
  topics: {},          // { topicName: { studied: true, score: 0-100 } }
  weakTopics: [],
  correctStreak: 0,
  totalTests: 0,
  totalCorrect: 0,
  totalTopics: 0,
  entAttempts: 0,
  achievements: { firstTopic: false, streak3: false, speedrun: false, genius: false },
  lastTopic: "",
  lastExplanation: "",
  currentLevel: "easy",
  photoData: null,
};

const LEVELS = [
  { rank: "Новичок",  avatar: "🧑‍🎓", xpNeeded: 0   },
  { rank: "Ученик",   avatar: "📚",    xpNeeded: 100 },
  { rank: "Профи",    avatar: "⚡",    xpNeeded: 300 },
  { rank: "Гений",    avatar: "🧠",    xpNeeded: 700 },
];

// ===== INIT =====
function init() {
  loadState();
  updateUI();
  updateNavRequests();

  // show premium btn if premium
  if (state.isPremium) {
    document.getElementById('hardmode-btn').style.display = '';
  }
}

// ===== STATE PERSISTENCE =====
function saveState() {
  localStorage.setItem('ai_teacher_state', JSON.stringify(state));
}
function loadState() {
  const raw = localStorage.getItem('ai_teacher_state');
  if (raw) {
    try {
      const saved = JSON.parse(raw);
      Object.assign(state, saved);
      // Reset daily requests if new day
      const today = new Date().toDateString();
      if (localStorage.getItem('ai_teacher_day') !== today && !state.isPremium) {
        state.requests = 5;
        localStorage.setItem('ai_teacher_day', today);
        saveState();
      }
    } catch(e) {}
  } else {
    localStorage.setItem('ai_teacher_day', new Date().toDateString());
  }
}

// ===== SCREEN ROUTING =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  if (id === 'profile') updateProfileUI();
}

// ===== UI UPDATES =====
function updateUI() {
  // XP & Level
  const lvlData = getLevelData();
  document.getElementById('sidebar-xp').textContent = state.xp;
  document.getElementById('sidebar-level').textContent = state.rank;
  updateNavRequests();
  updateRequestsBar();
}

function updateNavRequests() {
  const el = document.getElementById('nav-requests-count');
  if (state.isPremium) {
    el.textContent = '∞';
    el.parentElement.innerHTML = '⚡ Premium';
  } else {
    el.textContent = state.requests;
  }
}

function updateRequestsBar() {
  const pct = state.isPremium ? 100 : (state.requests / 5) * 100;
  document.getElementById('req-bar').style.width = pct + '%';
  const txt = state.isPremium ? 'Premium — безлимит ✓' : `${state.requests}/5 запросов`;
  document.getElementById('req-text').textContent = txt;
}

function getLevelData() {
  let current = LEVELS[0];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (state.xp >= LEVELS[i].xpNeeded) { current = LEVELS[i]; state.level = i + 1; state.rank = current.rank; break; }
  }
  return current;
}

function updateProfileUI() {
  const lvl = getLevelData();
  const nextLvl = LEVELS[Math.min(state.level, LEVELS.length - 1)];
  const prevXp = LEVELS[state.level - 1].xpNeeded;
  const nextXp = nextLvl ? nextLvl.xpNeeded : state.xp;
  const pct = nextXp > prevXp ? Math.min(100, ((state.xp - prevXp) / (nextXp - prevXp)) * 100) : 100;

  document.getElementById('profile-avatar-emoji').textContent = lvl.avatar;
  document.getElementById('profile-level-badge').textContent = 'Lv.' + state.level;
  document.getElementById('profile-rank').textContent = lvl.rank;
  document.getElementById('profile-xp').textContent = state.xp;
  document.getElementById('profile-xp-next').textContent = nextXp || state.xp;
  document.getElementById('profile-xp-bar').style.width = pct + '%';
  document.getElementById('streak-count').textContent = state.streak;
  document.getElementById('sidebar-xp').textContent = state.xp;
  document.getElementById('sidebar-level').textContent = state.rank;

  // Stats
  document.getElementById('stat-topics').textContent = state.totalTopics;
  document.getElementById('stat-tests').textContent = state.totalTests;
  const acc = state.totalTests > 0 ? Math.round((state.totalCorrect / state.totalTests) * 100) + '%' : '0%';
  document.getElementById('stat-correct').textContent = acc;
  document.getElementById('stat-ent').textContent = state.entAttempts + ' попыток';

  // Progress
  const progressList = document.getElementById('progress-list');
  const topics = Object.entries(state.topics);
  if (topics.length === 0) {
    progressList.innerHTML = '<div class="empty-state-small">Начни учиться, чтобы видеть прогресс</div>';
  } else {
    progressList.innerHTML = topics.slice(-5).map(([name, data]) => `
      <div class="progress-item">
        <div class="progress-item-header"><span>${name}</span><span>${data.score || 0}%</span></div>
        <div class="prog-bar-wrap"><div class="prog-bar" style="width:${data.score||0}%"></div></div>
      </div>`).join('');
  }

  // Weak topics
  const weakEl = document.getElementById('profile-weak-topics');
  if (state.weakTopics.length === 0) {
    weakEl.innerHTML = '<div class="empty-state-small">Пока ошибок нет — отличный старт!</div>';
  } else {
    weakEl.innerHTML = state.weakTopics.slice(0, 5).map(t => `
      <div class="weak-item">${t}</div>`).join('');
  }
  updateWeakTopicsSidebar();

  // Achievements
  updateAchievementsUI();
}

function updateWeakTopicsSidebar() {
  const el = document.getElementById('weak-topics-list');
  const block = document.getElementById('weak-topics-block');
  if (state.weakTopics.length === 0) {
    block.style.display = 'none';
  } else {
    block.style.display = '';
    el.innerHTML = state.weakTopics.slice(0, 3).map(t => `<div class="weak-item">${t}</div>`).join('');
  }
}

function updateAchievementsUI() {
  const grid = document.getElementById('achievements-grid');
  const achs = [
    { key: 'firstTopic',  icon: '🎯', name: 'Первая тема',    desc: 'Изучи первую тему',         xp: 50 },
    { key: 'streak3',     icon: '🔥', name: '3 подряд',        desc: '3 правильных ответа подряд', xp: 100 },
    { key: 'speedrun',    icon: '⚡', name: 'Спидран',          desc: 'Пройди тест за 30 секунд',   xp: 150 },
    { key: 'genius',      icon: '🧠', name: 'Гений',            desc: 'Набери 700 XP',              xp: 200 },
  ];
  grid.innerHTML = achs.map(a => `
    <div class="achievement ${state.achievements[a.key] ? '' : 'locked'}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-name">${a.name}</div>
      <div class="ach-status">${state.achievements[a.key] ? '✓ Получено' : 'Заблокировано'}</div>
    </div>`).join('');
}

// ===== XP SYSTEM =====
function addXP(amount, reason) {
  state.xp += amount;
  const oldRank = state.rank;
  getLevelData();

  // Update sidebar
  document.getElementById('sidebar-xp').textContent = state.xp;
  document.getElementById('sidebar-level').textContent = state.rank;

  // Level up notification
  if (state.rank !== oldRank) showToast('🎉', 'Новый уровень!', state.rank, '+' + amount + ' XP');

  // Check genius achievement
  if (state.xp >= 700 && !state.achievements.genius) {
    state.achievements.genius = true;
    setTimeout(() => showToast('🧠', 'Достижение!', 'Гений', '+200 XP'), 1500);
    state.xp += 200;
  }
  saveState();
}

// ===== TOAST =====
function showToast(icon, title, desc, xpText) {
  const toast = document.getElementById('achievement-toast');
  document.getElementById('toast-icon').textContent = icon;
  document.getElementById('toast-desc').textContent = desc;
  document.getElementById('toast-xp').textContent = xpText || '';
  toast.querySelector('.toast-title').textContent = title;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
}

// ===== LEARNING SCREEN =====
let currentSubject = 'math';
let currentLevelStr = 'easy';

function selectLevel(level, btn) {
  currentLevelStr = level;
  state.currentLevel = level;
  document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function quickTopic(topic) {
  document.getElementById('topic-input').value = topic;
  explainTopic();
}

async function explainTopic() {
  const topic = document.getElementById('topic-input').value.trim();
  const subject = document.getElementById('subject-select').value;
  if (!topic && !state.photoData) { alert('Введи тему для изучения'); return; }
  if (!checkRequests()) return;

  state.lastTopic = topic;
  state.totalTopics++;
  if (!state.topics[topic]) state.topics[topic] = { score: 0 };

  // First topic achievement
  if (!state.achievements.firstTopic) {
    state.achievements.firstTopic = true;
    setTimeout(() => showToast('🎯', 'Достижение!', 'Первая тема', '+50 XP'), 800);
    addXP(50);
  }

  showChat();
  const userMsg = topic || 'Объясни задачу с фото';
  addMessage('user', userMsg);

  const levelMap = { easy: 'простым языком с аналогиями', medium: 'стандартно с примерами', hard: 'углублённо с математическими формулами' };
  const adaptHint = state.weakTopics.includes(topic) ? ' Ученик ранее ошибался в этой теме — объясни особенно подробно.' : '';

  const systemPrompt = `Ты опытный казахстанский репетитор. Объясняй ${levelMap[currentLevelStr]}.${adaptHint} Используй эмодзи. Структурируй ответ. Говори по-русски. Будь дружелюбным и мотивирующим.`;
  const userPrompt = `Объясни тему "${topic}" по предмету "${subject}". Дай чёткое объяснение с примером.`;

  const messages = state.photoData
    ? [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: state.photoData } },
        { type: 'text', text: `Объясни и реши задачу с фото. Предмет: ${subject}.` }
      ]}]
    : [{ role: 'user', content: userPrompt }];

  const explanation = await callClaude(systemPrompt, messages);
  if (explanation) {
    state.lastExplanation = explanation;
    addMessage('bot', explanation);
    addXP(5);
    state.topics[topic].score = Math.min(100, (state.topics[topic].score || 0) + 10);
    updateWeakTopicsSidebar();
    saveState();
  }
}

async function simplifyExplanation() {
  if (!state.lastTopic) return;
  if (!checkRequests()) return;
  addMessage('user', '🔄 Объясни проще');
  const prompt = `Объясни "${state.lastTopic}" НАМНОГО проще — как будто ученику 10 лет. Используй аналогии из жизни, простые слова и смешные примеры.`;
  const explanation = await callClaude('Ты дружелюбный репетитор. Говори по-русски. Используй эмодзи.', [{ role: 'user', content: prompt }]);
  if (explanation) { state.lastExplanation = explanation; addMessage('bot', explanation); }
}

async function giveTask() {
  if (!state.lastTopic) return;
  if (!checkRequests()) return;
  addMessage('user', '✏️ Дай задание');
  const lvl = { easy: 'лёгкое', medium: 'среднее', hard: 'сложное' }[currentLevelStr] || 'среднее';
  const prompt = `Дай одно ${lvl} задание по теме "${state.lastTopic}". Формат: сначала условие задачи, затем на следующей строке напиши "Ответ: ||[правильный ответ]||" — ответ в скрытом виде.`;
  const result = await callClaude('Ты репетитор. Говори по-русски.', [{ role: 'user', content: prompt }]);
  if (result) addMessage('bot', result);
}

async function startMiniTest() {
  if (!state.lastTopic && !document.getElementById('topic-input').value) return;
  const topic = state.lastTopic || document.getElementById('topic-input').value;
  if (!checkRequests()) return;

  const testArea = document.getElementById('mini-test-area');
  testArea.classList.remove('hidden');
  document.getElementById('test-question').textContent = '⏳ Генерирую тест...';
  document.getElementById('test-options').innerHTML = '';
  document.getElementById('test-result').classList.add('hidden');

  const prompt = `Создай тест по теме "${topic}". Ответь ТОЛЬКО JSON без markdown и без backticks:
{"question":"вопрос","options":["A. вариант1","B. вариант2","C. вариант3","D. вариант4"],"correct":0}
correct — индекс правильного ответа (0-3).`;

  const raw = await callClaude('Отвечай только валидным JSON, без пояснений.', [{ role: 'user', content: prompt }]);
  if (!raw) return;

  let data;
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    data = JSON.parse(cleaned);
  } catch(e) {
    document.getElementById('test-question').textContent = '❌ Не удалось сгенерировать тест. Попробуй ещё раз.';
    return;
  }

  const startTime = Date.now();
  document.getElementById('test-question').textContent = data.question;
  document.getElementById('test-options').innerHTML = data.options.map((opt, i) => `
    <button class="test-option" onclick="checkAnswer(${i}, ${data.correct}, ${startTime})">${opt}</button>
  `).join('');
  state.totalTests++;
  saveState();
}

function checkAnswer(chosen, correct, startTime) {
  const elapsed = (Date.now() - startTime) / 1000;
  const opts = document.querySelectorAll('.test-option');
  opts.forEach(o => o.disabled = true);
  opts[correct].classList.add('correct');

  const resultEl = document.getElementById('test-result');
  resultEl.classList.remove('hidden', 'success', 'fail');

  if (chosen === correct) {
    opts[chosen].classList.add('correct');
    state.correctStreak++;
    state.totalCorrect++;
    addXP(10);
    resultEl.classList.add('success');
    resultEl.textContent = `✅ Правильно! +10 XP 🎉`;

    // Speedrun achievement
    if (elapsed < 30 && !state.achievements.speedrun) {
      state.achievements.speedrun = true;
      setTimeout(() => showToast('⚡', 'Достижение!', 'Спидран', '+150 XP'), 800);
      addXP(150);
    }
    // Streak achievement
    if (state.correctStreak >= 3 && !state.achievements.streak3) {
      state.achievements.streak3 = true;
      setTimeout(() => showToast('🔥', 'Достижение!', '3 правильных подряд!', '+100 XP'), 1000);
      addXP(100);
    }

    // Improve topic score
    if (state.lastTopic) {
      if (!state.topics[state.lastTopic]) state.topics[state.lastTopic] = { score: 0 };
      state.topics[state.lastTopic].score = Math.min(100, (state.topics[state.lastTopic].score || 0) + 20);
      state.weakTopics = state.weakTopics.filter(t => t !== state.lastTopic);
    }

    // Increase difficulty next time
    if (state.correctStreak >= 3 && currentLevelStr === 'easy') {
      currentLevelStr = 'medium';
      showToast('📈', 'Адаптация', 'Повышаю сложность!', '');
    }
  } else {
    opts[chosen].classList.add('wrong');
    state.correctStreak = 0;
    resultEl.classList.add('fail');
    resultEl.textContent = `❌ Неправильно. Правильный ответ: ${['A','B','C','D'][correct]}`;

    // Add to weak topics
    if (state.lastTopic && !state.weakTopics.includes(state.lastTopic)) {
      state.weakTopics.push(state.lastTopic);
    }

    // Simplify if too many mistakes
    const topicData = state.topics[state.lastTopic];
    if (topicData && topicData.score < 30) {
      currentLevelStr = 'easy';
      setTimeout(() => addMessage('bot', '💡 Я заметил, что эта тема даётся сложно. Попробую объяснить проще!'), 1500);
    }
  }
  updateWeakTopicsSidebar();
  saveState();
}

async function hardTeacherMode() {
  if (!state.isPremium) { showUpgrade(); return; }
  if (!state.lastTopic) return;
  if (!checkRequests()) return;
  addMessage('user', '😤 Режим жёсткого учителя');
  const prompt = `Выступи как ОЧЕНЬ строгий учитель. Проверь мои знания по теме "${state.lastTopic}". Задай 3 сложных вопроса подряд, критикуй неточности, не давай лёгких подсказок. Говори жёстко но по делу.`;
  const result = await callClaude('Ты строгий советский учитель. Не терпишь отмазок. Говоришь коротко и требовательно.', [{ role: 'user', content: prompt }]);
  if (result) addMessage('bot', result);
}

// ===== VOICE =====
function speakLast() {
  if (!state.lastExplanation) return;
  if (!('speechSynthesis' in window)) { alert('Ваш браузер не поддерживает голос'); return; }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(state.lastExplanation.replace(/[*#_`]/g, ''));
  utt.lang = 'ru-RU';
  utt.rate = 1;
  window.speechSynthesis.speak(utt);
}

// ===== PHOTO =====
function handlePhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const base64 = e.target.result.split(',')[1];
    state.photoData = base64;
    const preview = document.getElementById('photo-preview');
    preview.classList.remove('hidden');
    preview.innerHTML = `<img src="${e.target.result}" alt="Фото задачи">`;
    document.getElementById('photo-drop').style.borderColor = 'var(--accent3)';
  };
  reader.readAsDataURL(file);
}

// ===== CHAT HELPERS =====
function showChat() {
  document.getElementById('welcome-state').classList.add('hidden');
  document.getElementById('chat-container').classList.remove('hidden');
  if (state.isPremium) document.getElementById('hardmode-btn').style.display = '';
}

function addMessage(role, text) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const avatar = role === 'bot' ? '🤖' : '👤';
  const name = role === 'bot' ? 'AI Учитель' : 'Ты';
  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-body">
      <div class="msg-name">${name}</div>
      <div class="msg-bubble">${formatText(text)}</div>
    </div>`;
  container.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function formatText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>').replace(/$/, '</p>');
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'typing-msg';
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-body">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  container.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function removeTyping() {
  const el = document.getElementById('typing-msg');
  if (el) el.remove();
}

// ===== API CALL =====
async function callClaude(system, messages) {
  showChat();
  showTyping();
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system,
        messages
      })
    });
    removeTyping();
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 401) addMessage('bot', '❌ Неверный API ключ. Вставь свой ключ в script.js (строка 6).');
      else addMessage('bot', `❌ Ошибка API: ${err.error?.message || response.status}`);
      return null;
    }
    const data = await response.json();
    const text = data.content?.map(c => c.text || '').join('') || '';
    consumeRequest();
    return text;
  } catch(e) {
    removeTyping();
    // Demo mode when no API key
    const demo = getDemoResponse(messages[messages.length-1]?.content);
    if (demo) { consumeRequest(); return demo; }
    addMessage('bot', '❌ Ошибка сети. Проверь API ключ и соединение.');
    return null;
  }
}

function consumeRequest() {
  if (!state.isPremium) { state.requests = Math.max(0, state.requests - 1); }
  updateNavRequests();
  updateRequestsBar();
  saveState();
}

function checkRequests() {
  if (state.isPremium || state.requests > 0) return true;
  showUpgrade();
  return false;
}

// Demo responses when API key not set
function getDemoResponse(content) {
  if (API_KEY === 'PASTE_API_KEY_HERE') {
    const topic = typeof content === 'string' ? content : 'эту тему';
    return `🎓 **Демо-режим** (вставь API ключ для полного AI)\n\n**${topic}** — это важная тема!\n\nВот краткое объяснение:\n\n📌 Основная суть: понимание базовых концепций\n\n📐 Пример: представь это как строительство дома — сначала фундамент, потом стены\n\n💡 Ключевой момент: практика важнее теории\n\n✅ Попробуй решить простую задачу по этой теме, чтобы закрепить знания!`;
  }
  return null;
}

// ===== UPGRADE =====
function showUpgrade() {
  document.getElementById('upgrade-modal').classList.remove('hidden');
}
function closeUpgrade(e) {
  if (!e || e.target === document.getElementById('upgrade-modal')) {
    document.getElementById('upgrade-modal').classList.add('hidden');
  }
}
function activatePremium() {
  state.isPremium = true;
  document.getElementById('upgrade-modal').classList.add('hidden');
  document.getElementById('hardmode-btn').style.display = '';
  updateNavRequests();
  updateRequestsBar();
  saveState();
  showToast('⚡', 'Premium активирован!', 'Безлимитный доступ', '');
}

// ===== ENT MODE =====
let entQuestions = [];
let entAnswers = [];
let entCurrent = 0;
let entTimer = null;
let entTimeLeft = 0;
let entSubject = 'math';
let entStartTime = null;

const ENT_QUESTIONS = {
  math: [
    { q: 'Чему равна производная функции f(x) = x²?', opts: ['A. x', 'B. 2x', 'C. 2', 'D. x/2'], correct: 1 },
    { q: 'Если sin(α) = 0.5, то α = ?', opts: ['A. 30°', 'B. 45°', 'C. 60°', 'D. 90°'], correct: 0 },
    { q: 'Решите уравнение: 2x + 6 = 14', opts: ['A. x = 3', 'B. x = 4', 'C. x = 5', 'D. x = 10'], correct: 1 },
    { q: 'Площадь круга с радиусом 5 равна:', opts: ['A. 10π', 'B. 25π', 'C. 50π', 'D. 5π'], correct: 1 },
    { q: 'log₂(8) = ?', opts: ['A. 2', 'B. 4', 'C. 3', 'D. 6'], correct: 2 },
    { q: 'Чему равна сумма углов треугольника?', opts: ['A. 90°', 'B. 180°', 'C. 270°', 'D. 360°'], correct: 1 },
    { q: '∫2x dx = ?', opts: ['A. 2', 'B. x² + C', 'C. 2x² + C', 'D. x + C'], correct: 1 },
    { q: 'Если a² + b² = c², то это теорема:', opts: ['A. Виета', 'B. Фалеса', 'C. Пифагора', 'D. Эйлера'], correct: 2 },
    { q: 'Числа 2, 3, 5, 7, 11 — это:', opts: ['A. Чётные', 'B. Простые', 'C. Составные', 'D. Иррациональные'], correct: 1 },
    { q: '(-3)² = ?', opts: ['A. -9', 'B. 6', 'C. -6', 'D. 9'], correct: 3 },
  ],
  physics: [
    { q: 'Единица измерения силы в СИ:', opts: ['A. Джоуль', 'B. Ватт', 'C. Ньютон', 'D. Паскаль'], correct: 2 },
    { q: 'Формула второго закона Ньютона:', opts: ['A. F = mv', 'B. F = ma', 'C. F = m/a', 'D. F = v/t'], correct: 1 },
    { q: 'Скорость света в вакууме:', opts: ['A. 3×10⁸ м/с', 'B. 3×10⁶ м/с', 'C. 3×10¹⁰ м/с', 'D. 3×10⁴ м/с'], correct: 0 },
    { q: 'Закон сохранения энергии гласит:', opts: ['A. Энергия исчезает', 'B. Энергия создаётся', 'C. Энергия не создаётся и не исчезает', 'D. Энергия = масса'], correct: 2 },
    { q: 'КПД идеального двигателя Карно:', opts: ['A. 100%', 'B. Менее 100%', 'C. Равен 0', 'D. Бесконечен'], correct: 1 },
  ],
  history: [
    { q: 'В каком году Казахстан получил независимость?', opts: ['A. 1989', 'B. 1990', 'C. 1991', 'D. 1992'], correct: 2 },
    { q: 'Первый президент Республики Казахстан:', opts: ['A. К. Токаев', 'B. Н. Назарбаев', 'C. А. Байменов', 'D. Б. Сагинтаев'], correct: 1 },
    { q: 'Столица Казахстана с 1997 года:', opts: ['A. Алматы', 'B. Шымкент', 'C. Астана', 'D. Семей'], correct: 2 },
    { q: 'Великая степь — историческое название:', opts: ['A. Сибири', 'B. Казахстана', 'C. Монголии', 'D. Китая'], correct: 1 },
    { q: 'Кто такой Абай Кунанбаев?', opts: ['A. Хан', 'B. Полководец', 'C. Акын и мыслитель', 'D. Президент'], correct: 2 },
  ],
  biology: [
    { q: 'Основная структурная единица живого:', opts: ['A. Атом', 'B. Молекула', 'C. Клетка', 'D. Орган'], correct: 2 },
    { q: 'ДНК расшифровывается как:', opts: ['A. Дезоксирибонуклеиновая кислота', 'B. Динамическая нуклеиновая кислота', 'C. Двойная нуклеиновая кислота', 'D. Дифференцированная нуклеиновая кислота'], correct: 0 },
    { q: 'Процесс синтеза органических веществ из CO₂ и H₂O:', opts: ['A. Дыхание', 'B. Фотосинтез', 'C. Брожение', 'D. Гидролиз'], correct: 1 },
    { q: 'Сколько хромосом у человека?', opts: ['A. 23', 'B. 44', 'C. 46', 'D. 48'], correct: 2 },
    { q: 'Митохондрия — это:', opts: ['A. Депо воды', 'B. Электростанция клетки', 'C. Центр деления', 'D. Ядро клетки'], correct: 1 },
  ],
  chemistry: [
    { q: 'Атомный номер кислорода:', opts: ['A. 6', 'B. 7', 'C. 8', 'D. 9'], correct: 2 },
    { q: 'Формула воды:', opts: ['A. H₃O', 'B. HO₂', 'C. H₂O₂', 'D. H₂O'], correct: 3 },
    { q: 'pH нейтрального раствора:', opts: ['A. 0', 'B. 7', 'C. 14', 'D. 1'], correct: 1 },
    { q: 'Что такое моль?', opts: ['A. Масса вещества', 'B. Количество атомов', 'C. 6.022×10²³ частиц', 'D. Объём газа'], correct: 2 },
    { q: 'Наиболее активный металл:', opts: ['A. Золото', 'B. Натрий', 'C. Калий', 'D. Цезий'], correct: 3 },
  ],
  geography: [
    { q: 'Площадь Казахстана (приблизительно):', opts: ['A. 1.7 млн км²', 'B. 2.7 млн км²', 'C. 0.7 млн км²', 'D. 3.7 млн км²'], correct: 0 },
    { q: 'Самое большое озеро Казахстана:', opts: ['A. Балхаш', 'B. Аральское море', 'C. Зайсан', 'D. Алаколь'], correct: 0 },
    { q: 'Главная река Казахстана:', opts: ['A. Волга', 'B. Или', 'C. Иртыш', 'D. Сырдарья'], correct: 2 },
    { q: 'Казахстан граничит с Россией на:', opts: ['A. Юге', 'B. Западе и севере', 'C. Востоке', 'D. Северо-западе и севере'], correct: 3 },
    { q: 'Численность населения Казахстана (2024):', opts: ['A. ~10 млн', 'B. ~19 млн', 'C. ~25 млн', 'D. ~30 млн'], correct: 1 },
  ],
};

function selectEntSubject(subject, el) {
  entSubject = subject;
  document.querySelectorAll('.ent-subject-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function startENT() {
  if (!entSubject) { alert('Выбери предмет'); return; }
  state.entAttempts++;
  saveState();

  const count = parseInt(document.getElementById('ent-count').value);
  const timeMin = parseInt(document.getElementById('ent-time').value);

  const pool = ENT_QUESTIONS[entSubject] || ENT_QUESTIONS.math;
  entQuestions = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(count, pool.length));
  entAnswers = new Array(entQuestions.length).fill(null);
  entCurrent = 0;
  entTimeLeft = timeMin * 60;
  entStartTime = Date.now();

  document.getElementById('ent-setup').classList.add('hidden');
  document.getElementById('ent-active').classList.remove('hidden');
  document.getElementById('ent-result').classList.add('hidden');

  renderEntQuestion();
  renderEntDots();
  startEntTimer();
}

function renderEntQuestion() {
  const q = entQuestions[entCurrent];
  if (!q) return;
  document.getElementById('ent-q-counter').textContent = `${entCurrent+1}/${entQuestions.length}`;
  document.getElementById('ent-q-num').textContent = `Вопрос ${entCurrent+1}`;
  document.getElementById('ent-q-text').textContent = q.q;
  document.getElementById('ent-progress-fill').style.width = ((entCurrent+1)/entQuestions.length*100) + '%';

  const optContainer = document.getElementById('ent-options');
  optContainer.innerHTML = q.opts.map((opt, i) => `
    <button class="ent-option ${entAnswers[entCurrent] === i ? 'selected' : ''}"
      onclick="selectEntOption(${i}, this)">
      <span class="ent-opt-letter">${['A','B','C','D'][i]}</span>
      ${opt.replace(/^[ABCD]\. /, '')}
    </button>`).join('');

  document.getElementById('ent-prev-btn').disabled = entCurrent === 0;
  document.getElementById('ent-next-btn').textContent = entCurrent === entQuestions.length - 1 ? 'Завершить ✓' : 'Далее →';
}

function selectEntOption(index, el) {
  entAnswers[entCurrent] = index;
  document.querySelectorAll('.ent-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  renderEntDots();
}

function renderEntDots() {
  document.getElementById('ent-dots').innerHTML = entQuestions.map((_, i) => `
    <div class="ent-dot ${entAnswers[i] !== null ? 'answered' : ''} ${i === entCurrent ? 'current' : ''}"
      onclick="goToEntQ(${i})"></div>`).join('');
}

function entNext() {
  if (entCurrent < entQuestions.length - 1) {
    entCurrent++;
    renderEntQuestion();
    renderEntDots();
  } else {
    stopENT();
  }
}

function entPrev() {
  if (entCurrent > 0) {
    entCurrent--;
    renderEntQuestion();
    renderEntDots();
  }
}

function goToEntQ(i) { entCurrent = i; renderEntQuestion(); renderEntDots(); }

function startEntTimer() {
  clearInterval(entTimer);
  updateTimerDisplay();
  entTimer = setInterval(() => {
    entTimeLeft--;
    updateTimerDisplay();
    if (entTimeLeft <= 0) { clearInterval(entTimer); stopENT(); }
    if (entTimeLeft <= 60) document.getElementById('ent-timer').classList.add('warning');
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(entTimeLeft / 60);
  const s = entTimeLeft % 60;
  document.getElementById('ent-timer').textContent = `${m}:${s.toString().padStart(2,'0')}`;
}

function stopENT() {
  clearInterval(entTimer);
  const correct = entAnswers.filter((a, i) => a === entQuestions[i]?.correct).length;
  const total = entQuestions.length;
  const pct = Math.round((correct / total) * 100);
  const elapsedSec = Math.round((Date.now() - entStartTime) / 1000);

  // XP reward
  addXP(correct * 5);
  state.totalTests += total;
  state.totalCorrect += correct;
  saveState();

  document.getElementById('ent-active').classList.add('hidden');
  document.getElementById('ent-result').classList.remove('hidden');

  let icon = '😔', title = 'Нужно подтянуть!';
  if (pct >= 90) { icon = '🏆'; title = 'Блестяще! Готов к ЕНТ!'; }
  else if (pct >= 70) { icon = '🎯'; title = 'Хороший результат!'; }
  else if (pct >= 50) { icon = '📚'; title = 'Неплохо, но есть над чем работать'; }

  document.getElementById('result-icon').textContent = icon;
  document.getElementById('result-title').textContent = title;
  document.getElementById('result-score').textContent = `${correct}/${total}`;
  document.getElementById('result-percent').textContent = pct + '%';

  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  document.getElementById('result-details').innerHTML = `
    <div class="result-item"><span>Правильных ответов</span><span style="color:var(--accent3)">${correct}</span></div>
    <div class="result-item"><span>Неправильных ответов</span><span style="color:var(--red)">${total - correct}</span></div>
    <div class="result-item"><span>Процент</span><span>${pct}%</span></div>
    <div class="result-item"><span>Время</span><span>${mins}м ${secs}с</span></div>
    <div class="result-item"><span>XP заработано</span><span style="color:var(--gold)">+${correct * 5} XP</span></div>
  `;
}

function restartENT() {
  document.getElementById('ent-result').classList.add('hidden');
  document.getElementById('ent-setup').classList.remove('hidden');
}

// ===== START =====
document.addEventListener('DOMContentLoaded', init);
