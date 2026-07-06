emailjs.init("YOUR_PUBLIC_KEY");

const QUESTIONS_PATH = "questions/";
let manifest = [];
let currentQuestions = [];
let userAnswers = [];
let qIndex = 0;
let selectedDate = null;

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function updateStreak() {
  const last = localStorage.getItem('lastVisitDate');
  let streak = parseInt(localStorage.getItem('streakCount') || '0');
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (last === today) {
    // already visited today, keep streak
  } else if (last === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }
  localStorage.setItem('lastVisitDate', today);
  localStorage.setItem('streakCount', streak);
  document.getElementById('streakCount').textContent = streak;
}

async function loadManifest() {
  const res = await fetch(QUESTIONS_PATH + "manifest.json");
  manifest = await res.json();
  const select = document.getElementById('dateSelect');
  manifest.forEach(date => {
    const opt = document.createElement('option');
    opt.value = date; opt.textContent = date;
    select.appendChild(opt);
  });
  select.addEventListener('change', e => loadDate(e.target.value));
  loadDate(manifest[0]);
}

async function loadDate(date) {
  selectedDate = date;
  const res = await fetch(QUESTIONS_PATH + date + ".json");
  const data = await res.json();
  currentQuestions = data.questions;
  userAnswers = [];
  qIndex = 0;
  document.getElementById('finishScreen').style.display = 'none';
  document.getElementById('cardArea').innerHTML = '';
  document.getElementById('emailGate').style.display = 'block';
}

document.getElementById('startBtn').addEventListener('click', () => {
  const email = document.getElementById('studentEmail').value;
  if (!email) return alert('Please enter your email first 📧');
  localStorage.setItem('studentEmail', email);
  document.getElementById('emailGate').style.display = 'none';
  renderQuestion();
});

function updateProgress() {
  const pct = (qIndex / currentQuestions.length) * 100;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressLabel').textContent =
    `Question ${Math.min(qIndex+1, currentQuestions.length)} of ${currentQuestions.length}`;
}

function renderQuestion() {
  updateProgress();
  const container = document.getElementById('cardArea');
  container.innerHTML = '';

  if (qIndex >= currentQuestions.length) {
    showFinish();
    return;
  }

  const q = currentQuestions[qIndex];
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `<div class="q-text">${q.question}</div>`;

  if (q.type === 'mc') {
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'options';
    q.options.forEach((opt, i) => {
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
    ta.placeholder = 'Type your answer here...';
    card.appendChild(ta);
    const showBtn = document.createElement('button');
    showBtn.className = 'btn primary';
    showBtn.textContent = 'Show Answer 👀';
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

  optionsDiv.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correctIndex) btn.innerHTML = btn.textContent + ' ✅', btn.classList.add('correct');
    else if (i === selectedIdx) btn.classList.add('wrong');
  });

  const isCorrect = selectedIdx === q.correctIndex;
  recordAnswer(q, q.options[selectedIdx], isCorrect);
  revealAnswer(q, card);
}

function revealAnswer(q, card) {
  const box = document.createElement('div');
  box.className = 'answer-box';
  box.innerHTML = q.type === 'mc'
    ? `<strong>Explanation:</strong> ${q.explanation}`
    : `<strong>Model Answer:</strong> ${q.answer}<br><strong>Explanation:</strong> ${q.explanation}`;
  card.appendChild(box);

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn next';
  nextBtn.textContent = qIndex === currentQuestions.length - 1 ? 'Finish 🏁' : 'Next ➡️';
  nextBtn.addEventListener('click', () => { qIndex++; renderQuestion(); });
  card.appendChild(nextBtn);
}

function recordAnswer(q, selected, isCorrect) {
  userAnswers.push({ question: q.question, selected,
    correctAnswer: q.type === 'mc' ? q.options[q.correctIndex] : q.answer,
    isCorrect, explanation: q.explanation });
}

function showFinish() {
  const correctCount = userAnswers.filter(a => a.isCorrect === true).length;
  document.getElementById('finishScreen').style.display = 'block';
  document.getElementById('scoreText').textContent =
    `You got ${correctCount} out of ${currentQuestions.length} right today!`;
  confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
}

document.getElementById('sendEmailBtn').addEventListener('click', () => {
  const email = localStorage.getItem('studentEmail');
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

updateStreak();
loadManifest();
