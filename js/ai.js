/* AI Planner – Claude API integration, modal UI, task review */
const AiPlanner = (() => {
  const API_KEY_STORAGE = 'weeklyTodo_anthropicKey';
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL = 'claude-sonnet-4-5-20250929';
  function _getValidCategories() { return Categories.getAll().map(c => c.id); }
  const VALID_PRIORITIES = ['high', 'medium', 'low'];
  const MAX_TASKS = 20;

  let proposedTasks = [];

  /* ── API key helpers ───────────────────── */
  function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE) || '';
  }

  function saveApiKey(key) {
    if (key) {
      localStorage.setItem(API_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
    }
    updateKeyStatus();
  }

  /* ── DOM refs (resolved once on init) ──── */
  let els = {};

  function resolveElements() {
    const id = (s) => document.getElementById(s);
    els = {
      modal:      id('aiPlannerModal'),
      inputView:  id('aiInputView'),
      loadingView:id('aiLoadingView'),
      reviewView: id('aiReviewView'),
      textarea:   id('aiTextarea'),
      dateHint:   id('aiDateHint'),
      analyzeBtn: id('aiAnalyzeBtn'),
      cancelBtn:  id('aiCancelBtn'),
      error:      id('aiError'),
      // key section
      keyToggle:  id('aiKeyToggle'),
      keySection: id('aiKeySection'),
      keyInput:   id('aiKeyInput'),
      keySaveBtn: id('aiKeySaveBtn'),
      keyDot:     id('aiKeyDot'),
      // review
      reviewList: id('aiReviewList'),
      reviewCount:id('aiReviewCount'),
      addAllBtn:  id('aiAddAllBtn'),
      reviewBack: id('aiReviewBack'),
    };
  }

  /* ── View switching ────────────────────── */
  function showView(name) {
    els.inputView.classList.toggle('hidden', name !== 'input');
    els.loadingView.classList.toggle('hidden', name !== 'loading');
    els.reviewView.classList.toggle('hidden', name !== 'review');
    els.error.classList.add('hidden');
  }

  function showError(msg) {
    els.error.textContent = msg;
    els.error.classList.remove('hidden');
  }

  /* ── API key UI ────────────────────────── */
  function updateKeyStatus() {
    const hasKey = !!getApiKey();
    els.keyDot.className = 'ai-planner__key-dot ' + (hasKey ? 'ai-planner__key-dot--ok' : 'ai-planner__key-dot--missing');
  }

  function toggleKeySection() {
    const hidden = els.keySection.classList.toggle('hidden');
    if (!hidden) {
      els.keyInput.value = getApiKey();
      els.keyInput.focus();
    }
  }

  /* ── Build system prompt ───────────────── */
  function buildSystemPrompt(dateHint) {
    const today = Utils.toDateStr(new Date());
    const dayName = Utils.DAY_NAMES[new Date().getDay()];
    let hint = '';
    if (dateHint && dateHint !== 'auto') {
      hint = `\nThe user hinted the tasks should be scheduled for: "${dateHint}". Use this to choose appropriate dates.`;
    }
    return `You are a task extraction assistant. Today is ${dayName}, ${today}.${hint}

Analyze the user's text and extract actionable tasks. Return ONLY a JSON array (no other text) where each element has:
- "title": string (concise task title, max 80 chars)
- "date": string (YYYY-MM-DD format, choose sensible dates based on context)
- "category": one of ${JSON.stringify(_getValidCategories())}
- "priority": one of ${JSON.stringify(VALID_PRIORITIES)}

Rules:
- Extract only concrete, actionable tasks (not vague goals)
- If no date is obvious, spread tasks across the current and next week
- Infer category from context (meetings/deadlines→work, exercise→health, etc.)
- Infer priority from urgency cues (ASAP/urgent→high, nice-to-have→low, default→medium)
- Return at most ${MAX_TASKS} tasks
- If no actionable tasks are found, return an empty array []`;
  }

  /* ── Call Claude API ───────────────────── */
  async function callClaude(text, dateHint) {
    const apiKey = getApiKey();
    if (!apiKey) throw Object.assign(new Error('No API key set'), { code: 'NO_KEY' });

    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: buildSystemPrompt(dateHint),
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!resp.ok) {
      const status = resp.status;
      if (status === 401) throw new Error('Invalid API key. Check your key and try again.');
      if (status === 429) throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      if (status === 400) throw new Error('Bad request. Your input may be too long.');
      throw new Error(`API error (${status}). Please try again.`);
    }

    const data = await resp.json();
    const raw = data.content?.[0]?.text || '';
    return parseResponse(raw);
  }

  /* ── Parse & validate response ─────────── */
  function parseResponse(raw) {
    // Strip markdown fences if present
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    let tasks;
    try {
      tasks = JSON.parse(cleaned);
    } catch {
      throw new Error('No actionable tasks found in the response.');
    }

    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('No actionable tasks found. Try pasting more detailed text.');
    }

    return tasks.slice(0, MAX_TASKS).map(t => ({
      title: String(t.title || '').slice(0, 100),
      date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : Utils.toDateStr(new Date()),
      category: _getValidCategories().includes(t.category) ? t.category : (_getValidCategories()[0] || 'work'),
      priority: VALID_PRIORITIES.includes(t.priority) ? t.priority : 'medium',
    })).filter(t => t.title.trim());
  }

  /* ── Render review cards ───────────────── */
  function renderReviewCards() {
    els.reviewCount.textContent = `${proposedTasks.length} task${proposedTasks.length !== 1 ? 's' : ''}`;
    els.addAllBtn.disabled = proposedTasks.length === 0;

    els.reviewList.innerHTML = proposedTasks.map((task, i) => `
      <div class="ai-review-card ai-review-card--${task.priority}" data-index="${i}">
        <div class="ai-review-card__row">
          <input class="ai-review-card__title" type="text" value="${escapeAttr(task.title)}" data-field="title">
          <button class="ai-review-card__remove" data-action="remove" title="Remove task">&times;</button>
        </div>
        <div class="ai-review-card__row ai-review-card__meta">
          <input class="ai-review-card__date" type="date" value="${task.date}" data-field="date">
          <select class="ai-review-card__select" data-field="category">
            ${Categories.getAll().map(c => `<option value="${c.id}"${c.id === task.category ? ' selected' : ''}>${c.name}</option>`).join('')}
          </select>
          <select class="ai-review-card__select ai-review-card__select--priority" data-field="priority">
            ${VALID_PRIORITIES.map(p => `<option value="${p}"${p === task.priority ? ' selected' : ''}>${p[0].toUpperCase() + p.slice(1)}</option>`).join('')}
          </select>
        </div>
      </div>
    `).join('');
  }

  function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ── Event handlers ────────────────────── */
  function handleAnalyze() {
    const text = els.textarea.value.trim();
    if (!text) {
      showError('Please paste some text to analyze.');
      return;
    }
    if (!getApiKey()) {
      showError('Please set your API key first.');
      els.keySection.classList.remove('hidden');
      els.keyInput.focus();
      return;
    }

    showView('loading');

    callClaude(text, els.dateHint.value)
      .then(tasks => {
        if (tasks.length === 0) {
          showView('input');
          showError('No actionable tasks found. Try pasting more detailed text.');
          return;
        }
        proposedTasks = tasks;
        renderReviewCards();
        showView('review');
      })
      .catch(err => {
        showView('input');
        if (err.code === 'NO_KEY') {
          showError('Please set your API key first.');
          els.keySection.classList.remove('hidden');
          els.keyInput.focus();
        } else if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
          showError('Network error. Check your internet connection and try again.');
        } else {
          showError(err.message);
        }
      });
  }

  function handleReviewChange(e) {
    const card = e.target.closest('.ai-review-card');
    if (!card) return;
    const idx = parseInt(card.dataset.index, 10);

    if (e.target.dataset.action === 'remove') {
      proposedTasks.splice(idx, 1);
      renderReviewCards();
      if (proposedTasks.length === 0) {
        showView('input');
        showError('All tasks removed. Paste new text to try again.');
      }
      return;
    }

    const field = e.target.dataset.field;
    if (field && proposedTasks[idx]) {
      proposedTasks[idx][field] = e.target.value;
      // Update border color if priority changed
      if (field === 'priority') {
        card.className = `ai-review-card ai-review-card--${e.target.value}`;
      }
    }
  }

  function handleAddAll() {
    proposedTasks.forEach(task => {
      Store.add({
        title: task.title,
        date: task.date,
        category: task.category,
        priority: task.priority,
      });
    });
    proposedTasks = [];
    els.modal.close();
    App.render();
  }

  function openModal() {
    showView('input');
    els.textarea.value = '';
    els.dateHint.value = 'auto';
    updateKeyStatus();
    els.keySection.classList.add('hidden');
    els.modal.showModal();
    els.textarea.focus();
  }

  /* ── Init ───────────────────────────────── */
  function init() {
    resolveElements();

    // Open button
    document.getElementById('aiPlannerBtn').addEventListener('click', openModal);

    // Key section
    els.keyToggle.addEventListener('click', toggleKeySection);
    els.keySaveBtn.addEventListener('click', () => {
      saveApiKey(els.keyInput.value);
      els.keySection.classList.add('hidden');
    });
    els.keyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveApiKey(els.keyInput.value);
        els.keySection.classList.add('hidden');
      }
    });

    // Analyze
    els.analyzeBtn.addEventListener('click', handleAnalyze);

    // Cancel / close
    els.cancelBtn.addEventListener('click', () => els.modal.close());

    // Close on backdrop click
    els.modal.addEventListener('click', (e) => {
      if (e.target === els.modal) els.modal.close();
    });

    // Review list edits + remove
    els.reviewList.addEventListener('input', handleReviewChange);
    els.reviewList.addEventListener('click', handleReviewChange);

    // Add all
    els.addAllBtn.addEventListener('click', handleAddAll);

    // Back to input from review
    els.reviewBack.addEventListener('click', () => showView('input'));
  }

  document.addEventListener('DOMContentLoaded', init);

  return { open: openModal };
})();
