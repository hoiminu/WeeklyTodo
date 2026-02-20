/* Sticker reward system */
const Stickers = (() => {
  const STORAGE_KEY = 'weeklyTodo_stickers';
  const THRESHOLD = 0.8; // 80%

  const STICKER_IMAGE = 'icons/sticker.png';

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.stickers)) return data;
      }
    } catch (e) {
      console.warn('Failed to load stickers:', e);
    }
    return { stickers: [] };
  }

  function _save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /** Get all earned stickers */
  function getAll() {
    return _load().stickers;
  }

  /** Check if sticker already earned for a specific week key (e.g. "2025-W07") */
  function hasSticker(weekKey) {
    return _load().stickers.some(s => s.weekKey === weekKey);
  }

  /** Award a sticker for the given week */
  function award(weekKey, weekLabel, pct) {
    const data = _load();
    if (data.stickers.some(s => s.weekKey === weekKey)) return null;

    const sticker = {
      weekKey,
      weekLabel,
      pct: Math.round(pct * 100),
      earnedAt: Date.now(),
    };
    data.stickers.push(sticker);
    _save(data);
    return sticker;
  }

  /** Check the current week and award if eligible. Returns sticker or null. */
  function checkAndAward(weekDates) {
    const dateStrs = weekDates.map(d => Utils.toDateStr(d));
    const tasks = Store.getByWeek(dateStrs);
    if (tasks.length === 0) return null;

    const done = tasks.filter(t => t.completed).length;
    const pct = done / tasks.length;
    if (pct < THRESHOLD) return null;

    // Build week key from Monday date
    const monday = weekDates[0];
    const weekKey = Utils.toDateStr(monday);
    const weekLabel = Utils.formatWeekRange(weekDates);

    return award(weekKey, weekLabel, pct);
  }

  /** Remove a sticker by weekKey */
  function remove(weekKey) {
    const data = _load();
    data.stickers = data.stickers.filter(s => s.weekKey !== weekKey);
    _save(data);
  }

  return { getAll, hasSticker, checkAndAward, remove, THRESHOLD, STICKER_IMAGE };
})();
