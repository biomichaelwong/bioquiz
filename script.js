emailjs.init("YOUR_PUBLIC_KEY"); // <-- replace with your EmailJS public key

const QUESTIONS_PATH = "questions/";
let manifest = [];
let currentQuestions = [];
let userAnswers = [];
let qIndex = 0;
let selectedDate = null;
let currentLang = localStorage.getItem('lang') || 'en';

const uiText = {
  en: {
    streakLabel: "day streak",
    letsGo: "Let's go! 🚀",
    emailPrompt: "📧 Enter your email to save your results:",
    finishTitle: "🎉 Nice work!",
    sendResults: "Send my results 📩",
    showAnswer: "Show Answer 👀",
    next: "Next ➡️",
    finish: "Finish 🏁",
    explanation: "Explanation:",
    modelAnswer: "Model Answer:",
    sqPlaceholder: "Type your answer here...",
    questionOf: (i, total) => `Question ${i} of ${total}`,
    scoreText: (correct, total) => `You got ${correct} out of ${total} right today!`,
    toggleLabel: "中文"
  },
  zh: {
    streakLabel: "天連續紀錄",
    letsGo: "開始吧！🚀",
    emailPrompt: "📧 請輸入你的電郵以儲存成績：",
    finishTitle: "🎉 做得好！",
    sendResults: "傳送我的成績 📩",
    showAnswer: "顯示答案 👀",
    next: "下一題 ➡️",
    finish: "完成 🏁",
    explanation: "解釋：",
    modelAnswer: "參考答案：",
    sqPlaceholder: "在這裡輸入你的答案...",
    questionOf: (i, total) => `第 ${i} 題，共 ${total} 題`,
    scoreText: (correct, total) => `你今天答對了 ${correct} / ${total} 題！`,
    toggleLabel: "EN"
  }
};

function todayStr() { return new Date().toISOString().split('T')[0]; }

function updateStreak() {
  const last = localStorage.getItem('lastVisitDate');
  let streak = parseInt(localStorage.getItem('streakCount') || '0');
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (last === today) {
    // already counted today
  } else if (last === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }
  localStorage.setItem('lastVisitDate', today);
  localStorage.setItem('streakCount', streak);
  document.getElementById('streakCount').textContent = streak;
}

function applyLanguageToStaticUI() {
  document.getElementById('langToggle').textContent = uiText[currentLang].toggleLabel;
  document.querySelector('[data-i18n="streakLabel"]').textContent = uiText[currentLang].streakLabel;
  document.getElementById('startBtn').textContent = uiText[currentLang].letsGo;
  document.getElementById('emailPrompt').textContent = uiText[currentLang].emailPrompt;
  document.getElementById('finishTitle').textContent = uiText[currentLang].finishTitle;
  document.getElementById('sendEmailBtn').textContent = uiText[currentLang].sendResults;
}

document.getElementById('langToggle').addEventListener('click', () => {
  currentLang = currentLang === 'en' ? 'zh' : 'en';
  localStorage.setItem('lang', currentLang);
  applyLanguageToStaticUI();
  if (currentQuestions.length > 0) renderQuestion();
});

async function loadManifest() {
  try {
    const res = await fetch(QUESTIONS_PATH + "manifest.json");
    manifest = await res.json();
    const select = document.getElementById('dateSelect');
    select.innerHTML = '';
    manifest.forEach(date => {
      const opt = document.createElement('option');
      opt.value = date; opt.textContent = date;
      select.appendChild(opt);
    });
    select.addEventListener('change', e => loadDate(e.target.value));
    if (manifest.length > 0) loadDate(manifest[0]);
  } catch (err) {
    console.error('Failed to load manifest.json', err);
    document.getElementById('cardArea').innerHTML = '<p style="color:white;">⚠️ Could not load questions. Check manifest.json.</p>';
  }
}

async function loadDate(date) {
  try {
    selectedDate = date;
    const res = await fetch(QUESTIONS_PATH + date + ".json");
    const data = await res.json();
    currentQuestions = data.questions;
    userAnswers = [];
    qIndex = 0;
    document.getElementById('finishScreen').style.display = 'none';
    document.getElementById('cardArea').innerHTML = '';
    document.getElementById('emailGate').style.display = 'block';
    updateProgress();
  } catch (err) {
    console.error('Failed to load question file for date: ' + date, err);
  }
}

document.getElementById('startBtn').addEventListener('click', () => {
  const email = document.getElementById('studentEmail').value;
  if (!email) return alert(currentLang === 'en' ? 'Please enter your email first 📧' : '請先輸入你的電郵 📧');
  localStorage.setItem('studentEmail', email);
  document.getElementById('emailGate').style.display = 'none';
  renderQuestion();
});

function updateProgress() {
  const total = currentQuestions.length || 10;
  const pct = (qIndex / total) * 100;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressLabel').textContent =
    uiText[currentLang].questionOf(Math.min(qIndex + 1, total), total);
}

function renderQuestion() {
  updateProgress();
  const container = document.getElementById('cardArea');
  container.innerHTML = '';

  if (qIndex >= currentQuestions.length) { showFinish(); return; }

  const q = currentQuestions[qIndex];
  const qText = currentLang === 'en' ? q.question_en : q.question_zh;
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<div class="q-text">${qText}</div>`;

  if (q.type === 'mc') {
    const opts = currentLang === 'en' ? q.options_en : q.options_zh;
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'options';
    opts.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => selectMC(q, i, optionsDiv, card));
      optionsDiv.appendChild(btn);
    });
    card.appendChild(optionsDiv);
  } else {
    const ta = document.createElement('textarea');
    ta.className = 'sq-input';
    ta.placeholder = uiText[currentLang].sqPlaceholder;
    card.appendChild(ta);
    const showBtn = document.createElement('button');
    showBtn.className = 'btn primary';
    showBtn.textContent = uiText[currentLang].showAnswer;
    showBtn.addEventListener('click', () => {
      recordAnswer(q, ta.value || '(blank)', null);
      revealAnswer(q, card);
      showBtn.remove();
    });
    card.appendChild(showBtn);
  }
  container.appendChild(card);
}

function selectMC(q, selectedIdx, optionsDiv, card) {
  if (optionsDiv.dataset.answered) return;
  optionsDiv.dataset.answered = 'true';
  const opts = currentLang === 'en' ? q.options_en : q.options_zh;

  optionsDiv.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correctIndex) { btn.innerHTML = opts[i] + ' ✅'; btn.classList.add('correct'); }
    else if (i === selectedIdx) { btn.classList.add('wrong'); }
  });

  const isCorrect = selectedIdx === q.correctIndex;
  recordAnswer(q, opts[selectedIdx], isCorrect);
  revealAnswer(q, card);
}

function revealAnswer(q, card) {
  const box = document.createElement('div');
  box.className = 'answer-box';
  const explanation = currentLang === 'en' ? q.explanation_en : q.explanation_zh;
  box.innerHTML = q.type === 'mc'
    ? `<strong>${uiText[currentLang].explanation}</strong> ${explanation}`
    : `<strong>${uiText[currentLang].modelAnswer}</strong> ${currentLang === 'en' ? q.answer_en : q.answer_zh}<br><strong>${uiText[currentLang].explanation}</strong> ${explanation}`;
  card.appendChild(box);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn next';
  nextBtn.textContent = qIndex === currentQuestions.length - 1 ? uiText[currentLang].finish : uiText[currentLang].next;
  nextBtn.addEventListener('click', () => { qIndex++; renderQuestion(); });
  card.appendChild(nextBtn);
}

function recordAnswer(q, selected, isCorrect) {
  userAnswers.push({
    question: currentLang === 'en' ? q.question_en : q.question_zh,
    selected,
    correctAnswer: q.type === 'mc'
      ? (currentLang === 'en' ? q.options_en[q.correctIndex] : q.options_zh[q.correctIndex])
      : (currentLang === 'en' ? q.answer_en : q.answer_zh),
    isCorrect,
    explanation: currentLang === 'en' ? q.explanation_en : q.explanation_zh
  });
}

function showFinish() {
  const correctCount = userAnswers.filter(a => a.isCorrect === true).length;
  document.getElementById('finishScreen').style.display = 'block';
  document.getElementById('scoreText').textContent = uiText[currentLang].scoreText(correctCount, currentQuestions.length);
  confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
}

document.getElementById('sendEmailBtn').addEventListener('click', () => {
  const email = localStorage.getItem('studentEmail');
  if (!email) return alert(currentLang === 'en' ? 'No email found. Please restart the quiz.' : '找不到電郵，請重新開始測驗。');

  let summary = `Results for ${selectedDate}\n\n`;
  userAnswers.forEach((a, i) => {
    summary += `Q${i+1}: ${a.question}\nYour answer: ${a.selected}\n`;
    if (a.isCorrect !== null) summary += `Result: ${a.isCorrect ? 'Correct ✅' : 'Incorrect ❌'}\n`;
    summary += `Correct/Model Answer: ${a.correctAnswer}\nExplanation: ${a.explanation}\n\n`;
  });

  emailjs.send('YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', { to_email: email, message: summary })
    .then(() => document.getElementById('statusMsg').textContent = '✅ Sent! Check your inbox.')
    .catch(err => { document.getElementById('statusMsg').textContent = '❌ Failed to send.'; console.error(err); });
});

// ---- INIT ----
applyLanguageToStaticUI();
updateStreak();
loadManifest();
