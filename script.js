const QUESTIONS_PATH = "questions/";
const APPS_SCRIPT_URL = "PASTE_YOUR_WEB_APP_URL_HERE";

let manifest = [];
let currentQuestions = [];
let questionStates = [];
let maxReached = 0;
let qIndex = 0;
let selectedDate = null;
let currentLang = localStorage.getItem('lang') || 'en';
let currentIdToken = null;
let currentUserEmail = null;
let studentUsername = localStorage.getItem('studentUsername') || null;

const uiText = {
  en: {
    streakLabel: "day streak", emailPrompt: "🔐 Sign in with your Google account to start:",
    finishTitle: "🎉 Nice work!", sendResults: "Send my results 📩", showAnswer: "Show Answer 👀",
    next: "Next ➡️", finish: "Finish 🏁", explanation: "Explanation:", modelAnswer: "Model Answer:",
    sqPlaceholder: "Type your answer here...", questionOf: (i, t) => `Question ${i} of ${t}`,
    scoreText: (c, t) => `You got ${c} out of ${t} right today!`, signedInAs: (e) => `Signed in as: ${e}`,
    toggleLabel: "中文", sending: "Sending... ⏳", prev: "⬅ Prev", yourAnswer: "Your answer:"
  },
  zh: {
    streakLabel: "天連續紀錄", emailPrompt: "🔐 請使用你的 Google 帳戶登入以開始：",
    finishTitle: "🎉 做得好！", sendResults: "傳送我的成績 📩", showAnswer: "顯示答案 👀",
    next: "下一題 ➡️", finish: "完成 🏁", explanation: "解釋：", modelAnswer: "參考答案：",
    sqPlaceholder: "在這裡輸入你的答案...", questionOf: (i, t) => `第 ${i} 題，共 ${t} 題`,
    scoreText: (c, t) => `你今天答對了 ${c} / ${t} 題！`, signedInAs: (e) => `已登入：${e}`,
    toggleLabel: "EN", sending: "傳送中... ⏳", prev: "⬅ 上一題", yourAnswer: "你的答案："
  }
};

function todayStr() { return new Date().toISOString().split('T')[0]; }

function updateStreak() {
  const last = localStorage.getItem('lastVisitDate');
  let streak = parseInt(localStorage.getItem('streakCount') || '0');
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (last === today) {} else if (last === yesterday) { streak += 1; } else { streak = 1; }
  localStorage.setItem('lastVisitDate', today);
  localStorage.setItem('streakCount', streak);
  document.getElementById('streakCount').textContent = streak;
}

function applyLanguageToStaticUI() {
  document.getElementById('langToggle').textContent = uiText[currentLang].toggleLabel;
  document.querySelector('[data-i18n="streakLabel"]').textContent = uiText[currentLang].streakLabel;
  document.getElementById('emailPrompt').textContent = uiText[currentLang].emailPrompt;
  document.getElementById('finishTitle').textContent = uiText[currentLang].finishTitle;
  document.getElementById('sendEmailBtn').textContent = uiText[currentLang].sendResults;
}

document.getElementById('langToggle').addEventListener('click', () => {
  currentLang = currentLang === 'en' ? 'zh' : 'en';
  localStorage.setItem('lang', currentLang);
  applyLanguageToStaticUI();
  if (currentQuestions.length > 0 && qIndex < currentQuestions.length) renderQuestion();
});

function handleCredentialResponse(response) {
  currentIdToken = response.credential;
  const payload = JSON.parse(atob(currentIdToken.split('.')[1]));
  currentUserEmail = payload.email;
  document.getElementById('emailGate').style.display = 'none';

  if (!studentUsername) {
    document.getElementById('usernameGate').style.display = 'block';
  } else {
    renderQuestion();
  }
}

document.getElementById('usernameSaveBtn').addEventListener('click', () => {
  const val = document.getElementById('usernameInput').value.trim();
  if (!val) return alert(currentLang === 'en' ? 'Please enter a nickname.' : '請輸入暱稱。');
  studentUsername = val;
  localStorage.setItem('studentUsername', val);
  document.getElementById('usernameGate').style.display = 'none';
  renderQuestion();
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
  }
}

async function loadDate(date) {
  try {
    selectedDate = date;
    const res = await fetch(QUESTIONS_PATH + date + ".json");
    const data = await res.json();
    currentQuestions = data.questions;
    questionStates = currentQuestions.map(() => ({ answered: false, selected: null, isCorrect: null }));
    maxReached = 0;
    qIndex = 0;
    document.getElementById('finishScreen').style.display = 'none';
    document.getElementById('cardArea').style.display = 'block';
    document.getElementById('statusMsg').textContent = '';

    if (currentIdToken && studentUsername) {
      document.getElementById('emailGate').style.display = 'none';
      renderQuestion();
    } else {
      document.getElementById('emailGate').style.display = 'block';
      renderSidebar();
      updateProgress();
    }
  } catch (err) {
    console.error('Failed to load question file for date: ' + date, err);
  }
}

function updateProgress() {
  const total = currentQuestions.length || 10;
  const pct = (qIndex / total) * 100;
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressLabel').textContent =
    uiText[currentLang].questionOf(Math.min(qIndex + 1, total), total);
}

function renderSidebar() {
  const nav = document.getElementById('questionNav');
  nav.innerHTML = '';
  currentQuestions.forEach((q, i) => {
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.textContent = i + 1;
    const state = questionStates[i];
    if (i === qIndex) btn.classList.add('current');
    if (state && state.answered) {
      btn.classList.add(q.type === 'mc' ? (state.isCorrect ? 'correct' : 'wrong') : 'done');
    }
    if (i > maxReached) {
      btn.classList.add('locked');
      btn.disabled = true;
    } else {
      btn.addEventListener('click', () => jumpToQuestion(i));
    }
    nav.appendChild(btn);
  });

  const flagBtn = document.createElement('button');
  flagBtn.className = 'nav-btn flag';
  flagBtn.textContent = '🏁';
  if (maxReached >= currentQuestions.length - 1) {
    flagBtn.addEventListener('click', () => { qIndex = currentQuestions.length; renderQuestion(); });
  } else {
    flagBtn.classList.add('locked');
    flagBtn.disabled = true;
  }
  nav.appendChild(flagBtn);
}

function jumpToQuestion(i) { qIndex = i; renderQuestion(); }

function renderQuestion() {
  if (qIndex >= currentQuestions.length) { showFinish(); return; }
  maxReached = Math.max(maxReached, qIndex);
  updateProgress();
  renderSidebar();

  const container = document.getElementById('cardArea');
  container.innerHTML = '';
  document.getElementById('finishScreen').style.display = 'none';
  container.style.display = 'block';

  const q = currentQuestions[qIndex];
  const state = questionStates[qIndex];
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
      if (state.answered) {
        btn.disabled = true;
        if (i === q.correctIndex) { btn.innerHTML = opt + ' ✅'; btn.classList.add('correct'); }
        else if (i === state.selected) { btn.classList.add('wrong'); }
      } else {
        btn.addEventListener('click', () => {
          recordAnswer(qIndex, i, i === q.correctIndex);
          renderQuestion();
        });
      }
      optionsDiv.appendChild(btn);
    });
    card.appendChild(optionsDiv);
    if (state.answered) appendAnswerBox(q, card);
  } else {
    if (state.answered) {
      const shown = document.createElement('div');
      shown.className = 'sq-shown-answer';
      shown.innerHTML = `<strong>${uiText[currentLang].yourAnswer}</strong> ${state.selected}`;
      card.appendChild(shown);
      appendAnswerBox(q, card);
    } else {
      const ta = document.createElement('textarea');
      ta.className = 'sq-input';
      ta.placeholder = uiText[currentLang].sqPlaceholder;
      card.appendChild(ta);
      const showBtn = document.createElement('button');
      showBtn.className = 'btn primary';
      showBtn.textContent = uiText[currentLang].showAnswer;
      showBtn.addEventListener('click', () => {
        recordAnswer(qIndex, ta.value || '(blank)', null);
        renderQuestion();
      });
      card.appendChild(showBtn);
    }
  }

  if (state.answered) appendNavButtons(card);
  container.appendChild(card);
}

function appendAnswerBox(q, card) {
  const box = document.createElement('div');
  box.className = 'answer-box';
  const explanation = currentLang === 'en' ? q.explanation_en : q.explanation_zh;
  box.innerHTML = q.type === 'mc'
    ? `<strong>${uiText[currentLang].explanation}</strong> ${explanation}`
    : `<strong>${uiText[currentLang].modelAnswer}</strong> ${currentLang === 'en' ? q.answer_en : q.answer_zh}<br><strong>${uiText[currentLang].explanation}</strong> ${explanation}`;
  card.appendChild(box);
}

function appendNavButtons(card) {
  const navRow = document.createElement('div');
  navRow.className = 'nav-row';
  if (qIndex > 0) {
    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn prev';
    prevBtn.textContent = uiText[currentLang].prev;
    prevBtn.addEventListener('click', () => { qIndex--; renderQuestion(); });
    navRow.appendChild(prevBtn);
  }
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn next';
  nextBtn.textContent = qIndex === currentQuestions.length - 1 ? uiText[currentLang].finish : uiText[currentLang].next;
  nextBtn.addEventListener('click', () => { qIndex++; renderQuestion(); });
  navRow.appendChild(nextBtn);
  card.appendChild(navRow);
}

function recordAnswer(idx, selected, isCorrect) {
  questionStates[idx] = { answered: true, selected, isCorrect };
}

function showFinish() {
  document.getElementById('cardArea').style.display = 'none';
  const mcStates = questionStates.filter((s, i) => currentQuestions[i].type === 'mc');
  const correctCount = mcStates.filter(s => s.isCorrect === true).length;
  const totalMC = mcStates.length;

  document.getElementById('finishScreen').style.display = 'block';
  document.getElementById('scoreText').textContent = uiText[currentLang].scoreText(correctCount, totalMC);
  document.getElementById('signedInAs').textContent = uiText[currentLang].signedInAs(currentUserEmail);
  confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });

  submitScore(correctCount, totalMC);
}

function submitScore(score, total) {
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'submitScore', idToken: currentIdToken, username: studentUsername, date: selectedDate, score, total })
  })
  .then(res => res.json())
  .then(data => {
    const note = document.getElementById('scoreRecordNote');
    note.textContent = data.counted
      ? (currentLang === 'en' ? '🏆 Score recorded on leaderboard!' : '🏆 成績已記錄於排行榜！')
      : (currentLang === 'en' ? 'ℹ️ Only your first attempt counts.' : 'ℹ️ 只計算第一次作答成績。');
  })
  .catch(err => console.error(err));
}

function buildSummary() {
  let summary = `Results for ${selectedDate}\n\n`;
  currentQuestions.forEach((q, i) => {
    const state = questionStates[i];
    const qText = currentLang === 'en' ? q.question_en : q.question_zh;
    const correctAnswer = q.type === 'mc'
      ? (currentLang === 'en' ? q.options_en[q.correctIndex] : q.options_zh[q.correctIndex])
      : (currentLang === 'en' ? q.answer_en : q.answer_zh);
    const explanation = currentLang === 'en' ? q.explanation_en : q.explanation_zh;
    const selectedDisplay = q.type === 'mc'
      ? (state.selected != null ? (currentLang === 'en' ? q.options_en[state.selected] : q.options_zh[state.selected]) : '(not answered)')
      : (state.selected || '(not answered)');
    summary += `Q${i+1}: ${qText}\nYour answer: ${selectedDisplay}\n`;
    if (state.isCorrect !== null) summary += `Result: ${state.isCorrect ? 'Correct ✅' : 'Incorrect ❌'}\n`;
    summary += `Correct/Model Answer: ${correctAnswer}\nExplanation: ${explanation}\n\n`;
  });
  return summary;
}

document.getElementById('sendEmailBtn').addEventListener('click', () => {
  if (!currentIdToken) return alert(currentLang === 'en' ? 'Please sign in again.' : '請重新登入。');
  const summary = buildSummary();
  const btn = document.getElementById('sendEmailBtn');
  const statusMsg = document.getElementById('statusMsg');
  btn.disabled = true;
  btn.textContent = uiText[currentLang].sending;

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'sendResults', idToken: currentIdToken, date: selectedDate, summary })
  })
  .then(res => res.json())
  .then(data => {
    statusMsg.textContent = data.status === 'success'
      ? (currentLang === 'en' ? '✅ Sent! Check your inbox.' : '✅ 已傳送！')
      : (currentLang === 'en' ? '❌ Failed to send.' : '❌ 傳送失敗。');
  })
  .catch(err => { statusMsg.textContent = '❌ Failed.'; console.error(err); })
  .finally(() => { btn.disabled = false; btn.textContent = uiText[currentLang].sendResults; });
});

document.getElementById('leaderboardBtn').addEventListener('click', () => {
  document.getElementById('leaderboardModal').style.display = 'flex';
  loadLeaderboard();
});
document.getElementById('closeLeaderboard').addEventListener('click', () => {
  document.getElementById('leaderboardModal').style.display = 'none';
});

function loadLeaderboard() {
  const list = document.getElementById('leaderboardList');
  list.innerHTML = currentLang === 'en' ? 'Loading...' : '載入中...';
  fetch(APPS_SCRIPT_URL + '?action=leaderboard')
    .then(res => res.json())
    .then(data => {
      if (data.status !== 'success') { list.innerHTML = 'Error loading leaderboard.'; return; }
      list.innerHTML = '';
      data.leaderboard.forEach((u, i) => {
        const row = document.createElement('div');
        row.className = 'lb-row';
        row.innerHTML = `<span class="lb-rank">#${i+1}</span><span class="lb-name">${u.username}</span><span class="lb-score">${u.score}/${u.total} (${u.accuracy}%)</span>`;
        list.appendChild(row);
      });
    })
    .catch(err => { list.innerHTML = 'Error loading leaderboard.'; console.error(err); });
}

applyLanguageToStaticUI();
updateStreak();
loadManifest();
