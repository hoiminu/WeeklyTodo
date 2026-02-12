/* Sticker reward system */
const Stickers = (() => {
  const STORAGE_KEY = 'weeklyTodo_stickers';
  const THRESHOLD = 0.8; // 80%

  // Pool of stickers to randomly award
  const STICKER_POOL = [
    '⭐', '🌟', '🏆', '🎯', '🔥', '💪', '🚀', '🎉',
    '✨', '💎', '🦄', '🌈', '🍀', '🎨', '🧠', '💡',
    '🐝', '🦋', '🌸', '🍕', '🎵', '🎸', '🐶', '🐱',
    '🦊', '🐼', '🐨', '🐙', '🌊', '⚡', '🌻', '🍭',
  ];

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

  /** Pick a random sticker not recently used */
  function _pickSticker(existing) {
    const recent = existing.slice(-10).map(s => s.emoji);
    const available = STICKER_POOL.filter(e => !recent.includes(e));
    const pool = available.length > 0 ? available : STICKER_POOL;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Award a sticker for the given week */
  function award(weekKey, weekLabel, pct) {
    const data = _load();
    if (data.stickers.some(s => s.weekKey === weekKey)) return null;

    const sticker = {
      weekKey,
      weekLabel,
      emoji: _pickSticker(data.stickers),
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

  return { getAll, hasSticker, checkAndAward, THRESHOLD };
})();
