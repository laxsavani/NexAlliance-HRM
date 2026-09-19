/**
 * Date Utility Functions for DD/MM/YYYY Standard
 */

/**
 * Parses a string in DD/MM/YYYY or YYYY-MM-DD or ISO format into a valid Date object.
 * @param {string|Date} dateInput 
 * @returns {Date|null}
 */
const parseDate = (dateInput) => {
  if (!dateInput) return null;
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput;

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();

    // Check for DD/MM/YYYY or DD-MM-YYYY format
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyyMatch) {
      const day = parseInt(ddmmyyyyMatch[1], 10);
      const month = parseInt(ddmmyyyyMatch[2], 10) - 1; // 0-indexed in JS Date
      const year = parseInt(ddmmyyyyMatch[3], 10);
      const d = new Date(Date.UTC(year, month, day));
      return isNaN(d.getTime()) ? null : d;
    }

    // Fallback to standard Date parsing (e.g. YYYY-MM-DD or ISO)
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

/**
 * Formats a Date object or timestamp to "DD/MM/YYYY" string.
 * @param {Date|string|number} dateInput 
 * @returns {string|null}
 */
const formatDate = (dateInput) => {
  if (!dateInput) return null;
  const d = parseDate(dateInput);
  if (!d) return null;

  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();

  return `${day}/${month}/${year}`;
};

module.exports = {
  parseDate,
  formatDate
};
