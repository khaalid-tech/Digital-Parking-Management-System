/**
 * EJS Helper Functions for Digital Parking Management System
 * These helpers prevent common syntax errors and provide consistent formatting
 */

const moment = require('moment');

// Safe moment formatting - prevents multi-line syntax errors
function formatDate(date, format = 'MMM DD, YYYY') {
  if (!date) return 'N/A';
  try {
    return moment(date).format(format);
  } catch (error) {
    return 'Invalid Date';
  }
}

// Safe moment time formatting
function formatTime(date, format = 'HH:mm:ss') {
  if (!date) return 'N/A';
  try {
    return moment(date).format(format);
  } catch (error) {
    return 'Invalid Time';
  }
}

// Safe moment datetime formatting
function formatDateTime(date, format = 'MMM DD, HH:mm') {
  if (!date) return 'N/A';
  try {
    return moment(date).format(format);
  } catch (error) {
    return 'Invalid DateTime';
  }
}

// Safe status badge generation - prevents complex ternary syntax errors
function getStatusBadge(status, defaultStatus = 'pending') {
  const currentStatus = status || defaultStatus;
  const badgeClasses = {
    'pending': 'bg-warning',
    'paid': 'bg-success',
    'cancelled': 'bg-danger',
    'completed': 'bg-info',
    'active': 'bg-success',
    'inactive': 'bg-secondary',
    'open': 'bg-success',
    'closed': 'bg-secondary'
  };
  
  const badgeClass = badgeClasses[currentStatus] || 'bg-secondary';
  const displayText = currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1);
  
  return `<span class="badge ${badgeClass} text-white">${displayText}</span>`;
}

// Safe payment status badge
function getPaymentStatusBadge(paymentStatus) {
  return getStatusBadge(paymentStatus, 'pending');
}

// Safe shift status badge
function getShiftStatusBadge(shiftStatus) {
  return getStatusBadge(shiftStatus, 'closed');
}

// Safe slot status badge
function getSlotStatusBadge(slotStatus) {
  return getStatusBadge(slotStatus, 'vacant');
}

// Safe currency formatting
function formatCurrency(amount, currency = '$') {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `${currency}0.00`;
  }
  return `${currency}${parseFloat(amount).toFixed(2)}`;
}

// Safe number formatting
function formatNumber(number, decimals = 0) {
  if (number === null || number === undefined || isNaN(number)) {
    return '0';
  }
  return parseFloat(number).toFixed(decimals);
}

// Safe text truncation
function truncateText(text, maxLength = 50) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + '...';
}

// Safe HTML attribute escaping
function escapeHtml(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Safe conditional rendering
function renderIf(condition, trueContent, falseContent = '') {
  return condition ? trueContent : falseContent;
}

// Safe loop rendering with index
function renderLoop(array, callback) {
  if (!Array.isArray(array) || array.length === 0) {
    return '';
  }
  
  let result = '';
  array.forEach((item, index) => {
    result += callback(item, index);
  });
  return result;
}

// Safe navigation link generation
function getNavLink(href, text, icon = '', isActive = false) {
  const activeClass = isActive ? 'active' : '';
  const iconHtml = icon ? `<i class="${icon} me-1"></i>` : '';
  
  return `<a class="nav-link ${activeClass}" href="${href}">${iconHtml}${text}</a>`;
}

// Safe button generation
function getButton(href, text, variant = 'primary', icon = '', size = '') {
  const sizeClass = size ? `btn-${size}` : '';
  const iconHtml = icon ? `<i class="${icon} me-2"></i>` : '';
  
  return `<a href="${href}" class="btn btn-${variant} ${sizeClass}">${iconHtml}${text}</a>`;
}

// Safe table row generation
function getTableRow(data, columns) {
  let row = '<tr>';
  
  columns.forEach(column => {
    const value = data[column.key] || column.default || '';
    const className = column.className || '';
    const formatter = column.formatter || (val => val);
    
    row += `<td class="${className}">${formatter(value)}</td>`;
  });
  
  row += '</tr>';
  return row;
}

// Safe card generation
function getCard(title, content, variant = 'primary', icon = '') {
  const iconHtml = icon ? `<i class="${icon} me-2"></i>` : '';
  
  return `
    <div class="card border-0 shadow-sm">
      <div class="card-header bg-${variant} text-white">
        <h5 class="mb-0">${iconHtml}${title}</h5>
      </div>
      <div class="card-body">${content}</div>
    </div>
  `;
}

// Safe alert generation
function getAlert(message, type = 'info', dismissible = true) {
  const dismissibleAttr = dismissible ? 'alert-dismissible fade show' : '';
  const dismissButton = dismissible ? 
    '<button type="button" class="btn-close" data-bs-dismiss="alert"></button>' : '';
  
  return `
    <div class="alert alert-${type} ${dismissibleAttr}" role="alert">
      ${message}
      ${dismissButton}
    </div>
  `;
}

// Complex status function for multiple conditions
function getComplexStatus(condition1, value1, condition2, value2, defaultValue) {
  if (condition1) return value1;
  if (condition2) return value2;
  return defaultValue;
}

// Export all helpers
module.exports = {
  // Date/Time formatting
  formatDate,
  formatTime,
  formatDateTime,
  
  // Status badges
  getStatusBadge,
  getPaymentStatusBadge,
  getShiftStatusBadge,
  getSlotStatusBadge,
  getComplexStatus,
  
  // Formatting
  formatCurrency,
  formatNumber,
  truncateText,
  escapeHtml,
  
  // Conditional rendering
  renderIf,
  renderLoop,
  
  // UI components
  getNavLink,
  getButton,
  getTableRow,
  getCard,
  getAlert
};
