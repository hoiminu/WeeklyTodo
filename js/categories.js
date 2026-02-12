/* Category store – CRUD + dynamic CSS injection */
const Categories = (() => {
  const STORAGE_KEY = 'weeklyTodo_categories';
  const STYLE_ID = 'categoryStyles';

  const DEFAULTS = [
    { id: 'work',     name: 'Work',     color: '#3B82F6' },
    { id: 'personal', name: 'Personal', color: '#8B5CF6' },
    { id: 'health',   name: 'Health',   color: '#10B981' },
    { id: 'learning', name: 'Learning', color: '#F59E0B' },
  ];

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) return arr;
      }
    } catch (e) {
      console.warn('Failed to load categories:', e);
    }
    return null;
  }

  function _save(cats) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cats));
  }

  function _ensure() {
    if (!_load()) _save(DEFAULTS);
  }

  function getAll() {
    return _load() || DEFAULTS;
  }

  function get(id) {
    return getAll().find(c => c.id === id) || null;
  }

  function getColor(id) {
    const cat = get(id);
    return cat ? cat.color : '#94A3B8';
  }

  function getName(id) {
    const cat = get(id);
    return cat ? cat.name : id;
  }

  function _slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function add(name, color) {
    const cats = getAll();
    let id = _slugify(name);
    // Ensure unique id
    if (cats.some(c => c.id === id)) {
      id = id + '-' + Date.now().toString(36);
    }
    const newCat = { id, name: name.trim(), color };
    cats.push(newCat);
    _save(cats);
    applyColors();
    return newCat;
  }

  function update(id, changes) {
    const cats = getAll();
    const cat = cats.find(c => c.id === id);
    if (!cat) return null;
    if (changes.name !== undefined) cat.name = changes.name.trim();
    if (changes.color !== undefined) cat.color = changes.color;
    _save(cats);
    applyColors();
    return cat;
  }

  function remove(id) {
    let cats = getAll();
    const before = cats.length;
    cats = cats.filter(c => c.id !== id);
    if (cats.length === before) return false;
    _save(cats);
    applyColors();
    return true;
  }

  /** Inject/update a <style> tag with .cat-dot--<id> and .task-dot--<id> rules */
  function applyColors() {
    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }
    const cats = getAll();
    styleEl.textContent = cats.map(c =>
      `.cat-dot--${c.id} { background: ${c.color}; }\n.task-dot--${c.id} { background: ${c.color}; }`
    ).join('\n');
  }

  // Initialize on load
  _ensure();
  applyColors();

  return { getAll, get, getColor, getName, add, update, remove, applyColors };
})();
