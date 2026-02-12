/* localStorage CRUD layer */
const Store = (() => {
  const STORAGE_KEY = 'weeklyTodo';

  function _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.version === 1 && data.tasks) return data;
      }
    } catch (e) {
      console.warn('Failed to load data, resetting:', e);
    }
    return { version: 1, tasks: {} };
  }

  function _save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /** Get all tasks as an array */
  function getAll() {
    const data = _load();
    return Object.values(data.tasks);
  }

  /** Get tasks for a specific date string (YYYY-MM-DD) */
  function getByDate(dateStr) {
    return getAll().filter(t => t.date === dateStr);
  }

  /** Get tasks for a week (array of date strings) */
  function getByWeek(dateStrs) {
    const set = new Set(dateStrs);
    return getAll().filter(t => set.has(t.date));
  }

  /** Get tasks within a date range (inclusive, YYYY-MM-DD strings) */
  function getByDateRange(startStr, endStr) {
    return getAll().filter(t => t.date >= startStr && t.date <= endStr);
  }

  /** Add a new task, returns the task */
  function add(task) {
    const data = _load();
    const now = Date.now();
    const newTask = {
      id: Utils.generateId(),
      title: task.title.trim(),
      date: task.date,
      category: task.category || (Categories.getAll()[0]?.id || 'work'),
      priority: task.priority || 'medium',
      completed: false,
      createdAt: now,
      updatedAt: now,
    };
    data.tasks[newTask.id] = newTask;
    _save(data);
    return newTask;
  }

  /** Update an existing task by id */
  function update(id, changes) {
    const data = _load();
    if (!data.tasks[id]) return null;
    Object.assign(data.tasks[id], changes, { updatedAt: Date.now() });
    _save(data);
    return data.tasks[id];
  }

  /** Toggle completed state */
  function toggleComplete(id) {
    const data = _load();
    const task = data.tasks[id];
    if (!task) return null;
    task.completed = !task.completed;
    task.updatedAt = Date.now();
    _save(data);
    return task;
  }

  /** Delete a task by id */
  function remove(id) {
    const data = _load();
    if (!data.tasks[id]) return false;
    delete data.tasks[id];
    _save(data);
    return true;
  }

  return { getAll, getByDate, getByWeek, getByDateRange, add, update, toggleComplete, remove };
})();
