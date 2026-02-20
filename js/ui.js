/* DOM rendering, event handling, modal */
const UI = (() => {
  // Cached DOM references
  const $ = (sel) => document.querySelector(sel);
  const grid = $('#grid');
  const weekLabel = $('#weekLabel');
  const progressLabel = $('#progressLabel');
  const progressPct = $('#progressPct');
  const progressFill = $('#progressFill');
  const modal = $('#taskModal');
  const taskForm = $('#taskForm');
  const modalTitle = $('#modalTitle');
  const taskTitleInput = $('#taskTitle');
  const saveBtn = $('#saveBtn');
  const deleteBtn = $('#deleteBtn');
  const cancelBtn = $('#cancelBtn');
  const filtersEl = $('#filters');
  const categoryRadiosEl = $('#categoryRadios');
  const categoriesModal = $('#categoriesModal');
  const categoriesList = $('#categoriesList');
  const stickerBookModal = $('#stickerBookModal');
  const stickerBookBtn = $('#stickerBookBtn');
  const stickerCountEl = $('#stickerCount');

  let activeFilter = 'all';
  let editingTaskId = null;
  let editingDate = null;
  let draggedTaskId = null;

  // Track collapsed state for mobile
  const collapsedDays = new Set();

  // Track expanded day in month view (only one at a time)
  let expandedMonthDay = null;

  /** Sort tasks: incomplete first (by priority), then completed */
  function sortTasks(tasks) {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return tasks.slice().sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (!a.completed && !b.completed) {
        return (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1);
      }
      return 0;
    });
  }

  /** Render filter pills dynamically from Categories */
  function renderFilterPills() {
    const cats = Categories.getAll();
    let html = `<button class="filter-pill${activeFilter === 'all' ? ' filter-pill--active' : ''}" data-category="all">All</button>`;
    cats.forEach(c => {
      html += `<button class="filter-pill${activeFilter === c.id ? ' filter-pill--active' : ''}" data-category="${c.id}">
        <span class="cat-dot cat-dot--${c.id}"></span>${_escapeHtml(c.name)}
      </button>`;
    });
    html += `<button class="manage-categories-btn" id="manageCategoriesBtn" title="Manage categories">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M10.5 1.75L12.25 3.5L10.5 1.75ZM11.5 5.5L5.5 11.5H2.5V8.5L8.5 2.5L11.5 5.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>`;
    filtersEl.innerHTML = html;
  }

  /** Render category radio buttons in the task modal */
  function renderCategoryRadios(selectedCategory) {
    const cats = Categories.getAll();
    const selected = selectedCategory || (cats[0] ? cats[0].id : 'work');
    categoryRadiosEl.innerHTML = cats.map(c =>
      `<label class="radio-pill">
        <input type="radio" name="category" value="${c.id}"${c.id === selected ? ' checked' : ''}>
        <span class="radio-pill__label"><span class="cat-dot cat-dot--${c.id}"></span>${_escapeHtml(c.name)}</span>
      </label>`
    ).join('');
  }

  /** Render the week label */
  function renderWeekLabel(weekDates) {
    weekLabel.textContent = Utils.formatWeekRange(weekDates);
  }

  /** Render progress bar */
  function renderProgress(weekTasks) {
    const filtered = activeFilter === 'all'
      ? weekTasks
      : weekTasks.filter(t => t.category === activeFilter);
    const total = filtered.length;
    const done = filtered.filter(t => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    progressLabel.textContent = total === 0
      ? 'No tasks this week'
      : pct === 100
        ? 'All done!'
        : `${done} of ${total} tasks`;

    progressPct.textContent = `${pct}%`;
    progressFill.style.width = `${pct}%`;
    progressFill.classList.toggle('progress__fill--done', pct === 100 && total > 0);
  }

  /** Create task card HTML */
  function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = `task-card task-card--${task.priority}${task.completed ? ' task-card--done' : ''}`;
    card.dataset.taskId = task.id;
    card.draggable = true;

    card.style.borderLeftColor = Categories.getColor(task.category);

    card.innerHTML = `
      <label class="task-card__check" aria-label="Toggle complete">
        <input type="checkbox" ${task.completed ? 'checked' : ''}>
        <span class="task-card__checkbox"></span>
      </label>
      <div class="task-card__content">
        <span class="task-card__title">${_escapeHtml(task.title)}</span>
      </div>
    `;

    // Drag events
    card.addEventListener('dragstart', (e) => {
      draggedTaskId = task.id;
      card.classList.add('task-card--dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.id);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('task-card--dragging');
      draggedTaskId = null;
      document.querySelectorAll('.day-col--dragover, .month-cell--dragover').forEach(el =>
        el.classList.remove('day-col--dragover', 'month-cell--dragover')
      );
    });

    // Checkbox toggle
    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      Store.toggleComplete(task.id);
      App.render();
    });

    // Click card to edit
    card.addEventListener('click', (e) => {
      if (e.target.closest('.task-card__check')) return;
      openEditModal(task);
    });

    return card;
  }

  /** Render the 7-day grid */
  function renderGrid(weekDates) {
    grid.innerHTML = '';
    grid.classList.remove('grid--month');
    const dateStrs = weekDates.map(d => Utils.toDateStr(d));
    const allTasks = Store.getByWeek(dateStrs);

    weekDates.forEach((date, i) => {
      const dateStr = dateStrs[i];
      const col = document.createElement('div');
      col.className = 'day-col';
      if (Utils.isWeekend(date)) col.classList.add('day-col--weekend');
      if (Utils.isToday(date)) col.classList.add('day-col--today');

      const isCollapsed = collapsedDays.has(dateStr);

      col.innerHTML = `
        <div class="day-col__header">
          <span>
            <span class="day-label__full">${Utils.formatDayHeader(date)}</span>
            <span class="day-label__short">${Utils.DAY_SHORT[date.getDay()]} ${date.getDate()}</span>
          </span>
          <button class="day-col__toggle${isCollapsed ? ' day-col__toggle--collapsed' : ''}" aria-label="Toggle day">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="day-col__body${isCollapsed ? ' day-col__body--collapsed' : ''}"></div>
      `;

      // Toggle collapse on mobile
      const header = col.querySelector('.day-col__header');
      const toggle = col.querySelector('.day-col__toggle');
      const body = col.querySelector('.day-col__body');
      header.addEventListener('click', (e) => {
        if (window.innerWidth > 768) return;
        if (e.target.closest('.add-btn')) return;
        if (collapsedDays.has(dateStr)) {
          collapsedDays.delete(dateStr);
        } else {
          collapsedDays.add(dateStr);
        }
        body.classList.toggle('day-col__body--collapsed');
        toggle.classList.toggle('day-col__toggle--collapsed');
      });

      // Drop zone events
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        col.classList.add('day-col--dragover');
      });

      col.addEventListener('dragleave', (e) => {
        if (!col.contains(e.relatedTarget)) {
          col.classList.remove('day-col--dragover');
        }
      });

      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('day-col--dragover');
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) {
          Store.update(taskId, { date: dateStr });
          App.render();
        }
      });

      // Get tasks for this day, apply filter
      let dayTasks = allTasks.filter(t => t.date === dateStr);
      if (activeFilter !== 'all') {
        dayTasks = dayTasks.filter(t => t.category === activeFilter);
      }
      dayTasks = sortTasks(dayTasks);

      if (dayTasks.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'day-col__empty';
        empty.textContent = 'No tasks';
        body.appendChild(empty);
      } else {
        dayTasks.forEach(task => {
          body.appendChild(createTaskCard(task));
        });
      }

      // Add button
      const addBtn = document.createElement('button');
      addBtn.className = 'add-btn';
      addBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `;
      addBtn.title = 'Add task';
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openAddModal(dateStr);
      });
      body.appendChild(addBtn);

      grid.appendChild(col);
    });

    renderProgress(allTasks);
  }

  /** Render the month label */
  function renderMonthLabel(date) {
    weekLabel.textContent = Utils.formatMonth(date);
  }

  /** Render month calendar grid */
  function renderMonthGrid(year, month) {
    grid.innerHTML = '';
    grid.classList.add('grid--month');

    const calDates = Utils.getMonthCalendarDates(year, month);
    const currentMonth = new Date(year, month, 1);
    const startStr = Utils.toDateStr(calDates[0]);
    const endStr = Utils.toDateStr(calDates[calDates.length - 1]);
    const allTasks = Store.getByDateRange(startStr, endStr);

    // Group tasks by date
    const tasksByDate = {};
    allTasks.forEach(t => {
      if (!tasksByDate[t.date]) tasksByDate[t.date] = [];
      tasksByDate[t.date].push(t);
    });

    // Day-of-week header row (Mon-Sun)
    const headerRow = document.createElement('div');
    headerRow.className = 'month-grid__header';
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(name => {
      const el = document.createElement('div');
      el.className = 'month-grid__dow';
      el.textContent = name;
      headerRow.appendChild(el);
    });
    grid.appendChild(headerRow);

    // Render weeks (rows of 7)
    const numWeeks = calDates.length / 7;
    for (let w = 0; w < numWeeks; w++) {
      const weekRow = document.createElement('div');
      weekRow.className = 'month-grid__row';

      for (let d = 0; d < 7; d++) {
        const date = calDates[w * 7 + d];
        const dateStr = Utils.toDateStr(date);
        const inMonth = Utils.isSameMonth(date, currentMonth);
        const today = Utils.isToday(date);
        const weekend = Utils.isWeekend(date);
        const isExpanded = expandedMonthDay === dateStr;

        let dayTasks = tasksByDate[dateStr] || [];
        if (activeFilter !== 'all') {
          dayTasks = dayTasks.filter(t => t.category === activeFilter);
        }

        const cell = document.createElement('div');
        cell.className = 'month-cell';
        if (!inMonth) cell.classList.add('month-cell--outside');
        if (today) cell.classList.add('month-cell--today');
        if (weekend) cell.classList.add('month-cell--weekend');
        if (isExpanded) cell.classList.add('month-cell--expanded');
        cell.dataset.date = dateStr;

        // Day number
        const dateNum = document.createElement('div');
        dateNum.className = 'month-cell__date';
        dateNum.textContent = date.getDate();
        cell.appendChild(dateNum);

        // Task dots (max 4 shown)
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'month-cell__tasks';
        const MAX_DOTS = 4;
        dayTasks.slice(0, MAX_DOTS).forEach(task => {
          const dot = document.createElement('span');
          dot.className = `task-dot task-dot--${task.category}`;
          if (task.completed) dot.classList.add('task-dot--done');
          dotsContainer.appendChild(dot);
        });
        if (dayTasks.length > MAX_DOTS) {
          const more = document.createElement('span');
          more.className = 'month-cell__more';
          more.textContent = `+${dayTasks.length - MAX_DOTS}`;
          dotsContainer.appendChild(more);
        }
        cell.appendChild(dotsContainer);

        // Click to expand/collapse
        cell.addEventListener('click', (e) => {
          if (e.target.closest('.task-card') || e.target.closest('.add-btn') || e.target.closest('.task-card__check')) return;
          if (expandedMonthDay === dateStr) {
            expandedMonthDay = null;
          } else {
            expandedMonthDay = dateStr;
          }
          renderMonthGrid(year, month);
        });

        // Drag & drop on cells
        cell.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          cell.classList.add('month-cell--dragover');
        });
        cell.addEventListener('dragleave', (e) => {
          if (!cell.contains(e.relatedTarget)) {
            cell.classList.remove('month-cell--dragover');
          }
        });
        cell.addEventListener('drop', (e) => {
          e.preventDefault();
          cell.classList.remove('month-cell--dragover');
          const taskId = e.dataTransfer.getData('text/plain');
          if (taskId) {
            Store.update(taskId, { date: dateStr });
            App.render();
          }
        });

        weekRow.appendChild(cell);
      }

      grid.appendChild(weekRow);

      // If a day in this row is expanded, render the expanded detail row
      for (let d = 0; d < 7; d++) {
        const date = calDates[w * 7 + d];
        const dateStr = Utils.toDateStr(date);
        if (expandedMonthDay === dateStr) {
          let dayTasks = tasksByDate[dateStr] || [];
          if (activeFilter !== 'all') {
            dayTasks = dayTasks.filter(t => t.category === activeFilter);
          }
          dayTasks = sortTasks(dayTasks);

          const detailRow = document.createElement('div');
          detailRow.className = 'month-detail';

          const detailHeader = document.createElement('div');
          detailHeader.className = 'month-detail__header';
          detailHeader.innerHTML = `
            <span class="month-detail__date">${Utils.formatDayHeader(date)}</span>
            <span class="month-detail__count">${dayTasks.length} task${dayTasks.length !== 1 ? 's' : ''}</span>
          `;
          detailRow.appendChild(detailHeader);

          const detailBody = document.createElement('div');
          detailBody.className = 'month-detail__body';

          if (dayTasks.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'day-col__empty';
            empty.textContent = 'No tasks';
            detailBody.appendChild(empty);
          } else {
            dayTasks.forEach(task => {
              detailBody.appendChild(createTaskCard(task));
            });
          }

          // Add button
          const addBtn = document.createElement('button');
          addBtn.className = 'add-btn';
          addBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Add task
          `;
          addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openAddModal(dateStr);
          });
          detailBody.appendChild(addBtn);

          detailRow.appendChild(detailBody);
          grid.appendChild(detailRow);
          break;
        }
      }
    }

    // Progress for all tasks in the month (1st to last day of month)
    const monthStart = Utils.toDateStr(new Date(year, month, 1));
    const monthEnd = Utils.toDateStr(new Date(year, month + 1, 0));
    const monthTasks = Store.getByDateRange(monthStart, monthEnd);
    renderProgress(monthTasks);
  }

  /** Open modal for adding a task */
  function openAddModal(dateStr) {
    editingTaskId = null;
    editingDate = dateStr;
    modalTitle.textContent = 'New Task';
    saveBtn.textContent = 'Add Task';
    deleteBtn.classList.add('hidden');
    taskForm.reset();
    renderCategoryRadios();
    modal.showModal();
    taskTitleInput.focus();
  }

  /** Open modal for editing */
  function openEditModal(task) {
    editingTaskId = task.id;
    editingDate = task.date;
    modalTitle.textContent = 'Edit Task';
    saveBtn.textContent = 'Save';
    deleteBtn.classList.remove('hidden');

    taskTitleInput.value = task.title;
    renderCategoryRadios(task.category);
    taskForm.querySelector(`input[name="priority"][value="${task.priority}"]`).checked = true;

    modal.showModal();
    taskTitleInput.focus();
  }

  /** Handle form submit */
  function handleSubmit(e) {
    e.preventDefault();
    const title = taskTitleInput.value.trim();
    if (!title) return;

    const category = taskForm.querySelector('input[name="category"]:checked').value;
    const priority = taskForm.querySelector('input[name="priority"]:checked').value;

    if (editingTaskId) {
      Store.update(editingTaskId, { title, category, priority });
    } else {
      Store.add({ title, date: editingDate, category, priority });
    }

    modal.close();
    App.render();
  }

  /** Handle delete */
  function handleDelete() {
    if (!editingTaskId) return;
    if (!confirm('Delete this task?')) return;
    Store.remove(editingTaskId);
    modal.close();
    App.render();
  }

  /** Set active filter */
  function setFilter(category) {
    activeFilter = category;
    filtersEl.querySelectorAll('.filter-pill').forEach(pill => {
      pill.classList.toggle('filter-pill--active', pill.dataset.category === category);
    });
    App.render();
  }

  /** Open categories management modal */
  function openCategoriesModal() {
    renderCategoriesModalList();
    categoriesModal.showModal();
  }

  /** Render the list inside the categories modal */
  function renderCategoriesModalList() {
    const cats = Categories.getAll();
    categoriesList.innerHTML = cats.map(c =>
      `<div class="category-row" data-id="${c.id}">
        <input class="category-row__color" type="color" value="${c.color}" data-action="color">
        <input class="category-row__name" type="text" value="${_escapeHtml(c.name)}" data-action="name" maxlength="30">
        <button class="category-row__delete" data-action="delete" title="Delete category">&times;</button>
      </div>`
    ).join('');
  }

  /** Handle events inside the categories modal */
  function handleCategoryModalEvent(e) {
    const row = e.target.closest('.category-row');
    if (!row) return;
    const id = row.dataset.id;
    const action = e.target.dataset.action;

    if (action === 'color') {
      Categories.update(id, { color: e.target.value });
      _refreshAfterCategoryChange();
    } else if (action === 'name') {
      const name = e.target.value.trim();
      if (name) Categories.update(id, { name });
      _refreshAfterCategoryChange();
    } else if (action === 'delete') {
      Categories.remove(id);
      if (activeFilter === id) activeFilter = 'all';
      renderCategoriesModalList();
      _refreshAfterCategoryChange();
    }
  }

  /** Add a new category */
  function handleAddCategory() {
    Categories.add('New Category', '#6B7280');
    renderCategoriesModalList();
    _refreshAfterCategoryChange();
    // Focus the last name input for immediate editing
    const inputs = categoriesList.querySelectorAll('.category-row__name');
    if (inputs.length) inputs[inputs.length - 1].select();
  }

  /** Refresh pills + grid after any category change */
  function _refreshAfterCategoryChange() {
    Categories.applyColors();
    renderFilterPills();
    App.render();
  }

  /** Show sticker earned toast */
  function showStickerToast(sticker) {
    const toast = document.getElementById('stickerToast');
    toast.querySelector('.sticker-toast__emoji').textContent = sticker.emoji;
    toast.classList.add('sticker-toast--visible');
    updateStickerCount();
    setTimeout(() => toast.classList.remove('sticker-toast--visible'), 3000);
  }

  /** Update sticker count badge */
  function updateStickerCount() {
    const count = Stickers.getAll().length;
    stickerCountEl.textContent = count;
  }

  /** Render sticker book contents */
  function renderStickerBook() {
    const body = stickerBookModal.querySelector('.sticker-book__body');
    const stickers = Stickers.getAll();
    const subtitle = stickerBookModal.querySelector('.sticker-book__subtitle');
    subtitle.textContent = `${stickers.length} sticker${stickers.length !== 1 ? 's' : ''} earned`;

    if (stickers.length === 0) {
      body.innerHTML = `
        <div class="sticker-book__empty">
          <div class="sticker-book__empty-icon">🎯</div>
          <div class="sticker-book__empty-text">No stickers yet!</div>
          <div class="sticker-book__empty-hint">Complete 80% of your weekly tasks to earn stickers</div>
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'sticker-grid';

    // Show stickers in reverse chronological order
    [...stickers].reverse().forEach(s => {
      const slot = document.createElement('div');
      slot.className = 'sticker-slot sticker-slot--earned';
      slot.innerHTML = `
        <button class="sticker-slot__delete" data-week-key="${s.weekKey}" title="Remove sticker">&times;</button>
        <span class="sticker-slot__emoji">${s.emoji}</span>
        <span class="sticker-slot__week">${s.weekLabel}</span>
        <span class="sticker-slot__pct">${s.pct}% done</span>
      `;
      slot.querySelector('.sticker-slot__delete').addEventListener('click', (e) => {
        e.stopPropagation();
        Stickers.remove(s.weekKey);
        updateStickerCount();
        renderStickerBook();
      });
      grid.appendChild(slot);
    });

    body.innerHTML = '';
    body.appendChild(grid);
  }

  /** Initialize event listeners */
  function init() {
    taskForm.addEventListener('submit', handleSubmit);
    cancelBtn.addEventListener('click', () => modal.close());
    deleteBtn.addEventListener('click', handleDelete);

    // Close modal on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.close();
    });

    // Close modal on Escape (native dialog behavior, but also reset state)
    modal.addEventListener('close', () => {
      editingTaskId = null;
      editingDate = null;
    });

    // Render dynamic filter pills
    renderFilterPills();

    // Filters (delegated — pills are re-rendered dynamically)
    filtersEl.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill');
      if (pill) { setFilter(pill.dataset.category); return; }
      if (e.target.closest('#manageCategoriesBtn') || e.target.closest('.manage-categories-btn')) {
        openCategoriesModal();
      }
    });

    // Categories modal events
    categoriesList.addEventListener('input', handleCategoryModalEvent);
    categoriesList.addEventListener('click', handleCategoryModalEvent);
    $('#addCategoryBtn').addEventListener('click', handleAddCategory);
    $('#categoriesDoneBtn').addEventListener('click', () => categoriesModal.close());
    categoriesModal.addEventListener('click', (e) => {
      if (e.target === categoriesModal) categoriesModal.close();
    });

    // Sticker book
    stickerBookBtn.addEventListener('click', () => {
      renderStickerBook();
      stickerBookModal.showModal();
    });

    stickerBookModal.addEventListener('click', (e) => {
      if (e.target === stickerBookModal) stickerBookModal.close();
    });

    stickerBookModal.querySelector('.sticker-book__close').addEventListener('click', () => {
      stickerBookModal.close();
    });

    updateStickerCount();
  }

  /** Escape HTML to prevent XSS */
  function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, renderGrid, renderWeekLabel, renderMonthLabel, renderMonthGrid, renderProgress, showStickerToast, updateStickerCount, renderFilterPills };
})();
