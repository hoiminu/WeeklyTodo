/* Date helpers and ID generation */
const Utils = (() => {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /** Return date string YYYY-MM-DD in local time */
  function toDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Parse YYYY-MM-DD to Date at midnight local */
  function parseDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  /** Get Monday of the week containing `date` */
  function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Sunday -> go back 6
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Return array of 7 Date objects Mon-Sun for the week containing `date` */
  function getWeekDates(date) {
    const mon = getMonday(date);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return d;
    });
  }

  /** Format like "Feb 10 - Feb 16, 2025" */
  function formatWeekRange(dates) {
    const first = dates[0];
    const last = dates[6];
    const startMonth = MONTH_SHORT[first.getMonth()];
    const endMonth = MONTH_SHORT[last.getMonth()];
    const startDay = first.getDate();
    const endDay = last.getDate();
    const year = last.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  }

  /** Format a single date like "Mon 10" */
  function formatDayHeader(date) {
    return `${DAY_SHORT[date.getDay()]} ${date.getDate()}`;
  }

  /** Check if two dates are the same calendar day */
  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  }

  /** Check if a date is today */
  function isToday(date) {
    return isSameDay(date, new Date());
  }

  /** Check if date is Saturday or Sunday */
  function isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  /** Get array of dates for a month calendar grid (35-42 days, starting Monday) */
  function getMonthCalendarDates(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // Start from Monday of the week containing the 1st
    const start = getMonday(firstDay);
    // End on Sunday of the week containing the last day
    const endDate = new Date(lastDay);
    const endDow = endDate.getDay();
    const end = new Date(endDate);
    if (endDow !== 0) {
      end.setDate(end.getDate() + (7 - endDow));
    }
    const dates = [];
    const d = new Date(start);
    while (d <= end) {
      dates.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return dates;
  }

  /** Format like "February 2026" */
  function formatMonth(date) {
    return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
  }

  /** Check if two dates are in the same month and year */
  function isSameMonth(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  }

  /** Generate unique ID */
  function generateId() {
    const ts = Date.now();
    const rand = Math.random().toString(36).substring(2, 8);
    return `task_${ts}_${rand}`;
  }

  return {
    DAY_NAMES,
    DAY_SHORT,
    MONTH_NAMES,
    toDateStr,
    parseDate,
    getMonday,
    getWeekDates,
    getMonthCalendarDates,
    formatWeekRange,
    formatMonth,
    formatDayHeader,
    isSameDay,
    isSameMonth,
    isToday,
    isWeekend,
    generateId,
  };
})();
