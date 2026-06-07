'use strict';

/**
 * Format a Date object (or date string) to YYYY-MM-DD.
 * If no argument is supplied the current date is used.
 *
 * @param {Date|string} [date] - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  const d = date ? new Date(date) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Convert an array of plain objects to a CSV string.
 *
 * @param {Object[]} rows   - Data rows
 * @param {string[]} headers - Column headers (keys of the objects)
 * @returns {string} CSV-formatted string
 */
function generateCSV(rows, headers) {
  if (!rows || rows.length === 0) {
    return headers.join(',') + '\n';
  }

  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // Wrap in quotes if the value contains a comma, newline, or double-quote
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escape).join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => escape(row[h])).join(',')
  );

  return [headerLine, ...dataLines].join('\n') + '\n';
}

/**
 * Validate that all required fields are present on an object.
 *
 * @param {Object}   obj    - Object to validate
 * @param {string[]} fields - Required field names
 * @returns {string[]} Array of missing field names (empty if all present)
 */
function validateRequired(obj, fields) {
  if (!obj || typeof obj !== 'object') return [...fields];

  return fields.filter((field) => {
    const val = obj[field];
    return val === undefined || val === null || (typeof val === 'string' && val.trim() === '');
  });
}

/**
 * Basic XSS prevention — trims whitespace and escapes dangerous HTML characters.
 *
 * @param {string} str - Raw user input
 * @returns {string} Sanitized string
 */
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

module.exports = {
  formatDate,
  generateCSV,
  validateRequired,
  sanitizeInput,
};
