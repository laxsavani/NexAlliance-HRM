/**
 * Convert array of JSON objects to CSV string
 * @param {Array<Object>} data - Array of objects
 * @param {Array<{ key: string, label: string }>} columns - Column definitions
 * @returns {string} CSV formatted string
 */
const jsonToCSV = (data = [], columns = []) => {
  if (!data || data.length === 0) {
    if (columns && columns.length > 0) {
      return columns.map(c => `"${c.label}"`).join(',') + '\n';
    }
    return '';
  }

  // If columns not provided, derive from first row keys
  const resolvedCols = (columns && columns.length > 0)
    ? columns
    : Object.keys(data[0]).map(k => ({ key: k, label: k.toUpperCase() }));

  // Header line
  const headerLine = resolvedCols.map(c => `"${c.label.replace(/"/g, '""')}"`).join(',');

  // Data lines
  const dataLines = data.map(row => {
    return resolvedCols.map(col => {
      let val = row[col.key];
      if (val === null || val === undefined) {
        val = '';
      } else if (typeof val === 'object') {
        val = JSON.stringify(val);
      } else {
        val = String(val);
      }
      return `"${val.replace(/"/g, '""')}"`;
    }).join(',');
  });

  return [headerLine, ...dataLines].join('\n');
};

/**
 * Stream CSV download response
 */
const sendCSVResponse = (res, filename, csvString) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.status(200).send(csvString);
};

module.exports = {
  jsonToCSV,
  sendCSVResponse
};
