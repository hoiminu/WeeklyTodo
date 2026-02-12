/* Entry point, navigation, initialization */
const App = (() => {
  let currentView = 'week'; // 'week' | 'month'
  let currentWeekStart = Utils.getMonday(new Date());
  let currentMonthDate = new Date(); // any date in the current month

  function getWeekDates() {
    return Utils.getWeekDates(currentWeekStart);
  }

  function render() {
    if (currentView === 'week') {
      const dates = getWeekDates();
      UI.renderWeekLabel(dates);
      UI.renderGrid(dates);
      const sticker = Stickers.checkAndAward(dates);
      if (sticker) {
        UI.showStickerToast(sticker);
      }
    } else {
      UI.renderMonthLabel(currentMonthDate);
      UI.renderMonthGrid(currentMonthDate.getFullYear(), currentMonthDate.getMonth());
    }
    UI.updateStickerCount();
  }

  function prevWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    render();
  }

  function nextWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    render();
  }

  function prevMonth() {
    currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
    render();
  }

  function nextMonth() {
    currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);
    render();
  }

  function prev() {
    if (currentView === 'week') prevWeek();
    else prevMonth();
  }

  function next() {
    if (currentView === 'week') nextWeek();
    else nextMonth();
  }

  function goToday() {
    currentWeekStart = Utils.getMonday(new Date());
    currentMonthDate = new Date();
    render();
  }

  function setView(view) {
    if (view === currentView) return;
    currentView = view;
    // Sync: if switching to month, set month from current week; vice versa
    if (view === 'month') {
      currentMonthDate = new Date(currentWeekStart);
    } else {
      currentWeekStart = Utils.getMonday(currentMonthDate);
    }
    // Update toggle buttons
    document.querySelectorAll('.view-toggle__btn').forEach(btn => {
      btn.classList.toggle('view-toggle__btn--active', btn.dataset.view === view);
    });
    render();
  }

  function init() {
    UI.init();

    document.getElementById('prevBtn').addEventListener('click', prev);
    document.getElementById('nextBtn').addEventListener('click', next);
    document.getElementById('todayBtn').addEventListener('click', goToday);

    // View toggle
    document.getElementById('viewToggle').addEventListener('click', (e) => {
      const btn = e.target.closest('.view-toggle__btn');
      if (btn) setView(btn.dataset.view);
    });

    // Keyboard nav
    document.addEventListener('keydown', (e) => {
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    });

    render();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { render, setView };
})();
