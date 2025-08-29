// Main JavaScript for Digital Parking Management System

// Global variables
let isOnline = navigator.onLine;
let refreshInterval;

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  initializeSystem();
  setupEventListeners();
  startAutoRefresh();
});

// Initialize system
function initializeSystem() {
  console.log("🚗 Digital Parking Management System initialized");

  // Check online status
  updateOnlineStatus();

  // Initialize tooltips
  if (typeof bootstrap !== "undefined") {
    const tooltipTriggerList = [].slice.call(
      document.querySelectorAll('[data-bs-toggle="tooltip"]')
    );
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }

  // Initialize popovers
  if (typeof bootstrap !== "undefined") {
    const popoverTriggerList = [].slice.call(
      document.querySelectorAll('[data-bs-toggle="popover"]')
    );
    popoverTriggerList.map(function (popoverTriggerEl) {
      return new bootstrap.Popover(popoverTriggerEl);
    });
  }
}

// Setup event listeners
function setupEventListeners() {
  // Online/offline status
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);

  // Form validation
  setupFormValidation();

  // Table sorting
  setupTableSorting();

  // Search functionality
  setupSearch();

  // Print functionality
  setupPrint();
}

// Update online status
function updateOnlineStatus() {
  isOnline = navigator.onLine;
  const statusElement = document.getElementById("online-status");

  if (statusElement) {
    if (isOnline) {
      statusElement.innerHTML =
        '<i class="bi bi-wifi text-success"></i> Online';
      statusElement.className = "badge bg-success";
    } else {
      statusElement.innerHTML =
        '<i class="bi bi-wifi-off text-danger"></i> Offline';
      statusElement.className = "badge bg-danger";
    }
  }

  // Show notification
  if (!isOnline) {
    showNotification(
      "You are currently offline. Some features may not work.",
      "warning"
    );
  }
}

// Setup form validation
function setupFormValidation() {
  const forms = document.querySelectorAll(".needs-validation");

  forms.forEach((form) => {
    form.addEventListener("submit", function (event) {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      form.classList.add("was-validated");
    });
  });
}

// Setup table sorting
function setupTableSorting() {
  const sortableHeaders = document.querySelectorAll("[data-sort]");

  sortableHeaders.forEach((header) => {
    header.addEventListener("click", function () {
      const table = this.closest("table");
      const tbody = table.querySelector("tbody");
      const rows = Array.from(tbody.querySelectorAll("tr"));
      const columnIndex = Array.from(this.parentNode.children).indexOf(this);
      const sortDirection = this.dataset.sort === "asc" ? "desc" : "asc";

      // Update sort direction
      this.dataset.sort = sortDirection;

      // Sort rows
      rows.sort((a, b) => {
        const aValue = a.children[columnIndex].textContent.trim();
        const bValue = b.children[columnIndex].textContent.trim();

        if (sortDirection === "asc") {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      });

      // Reorder rows
      rows.forEach((row) => tbody.appendChild(row));

      // Update sort indicator
      updateSortIndicator(this, sortDirection);
    });
  });
}

// Update sort indicator
function updateSortIndicator(header, direction) {
  // Remove existing indicators
  header
    .querySelectorAll(".sort-indicator")
    .forEach((indicator) => indicator.remove());

  // Add new indicator
  const indicator = document.createElement("i");
  indicator.className = `sort-indicator bi bi-arrow-${
    direction === "asc" ? "up" : "down"
  }`;
  indicator.style.marginLeft = "5px";
  header.appendChild(indicator);
}

// Setup search functionality
function setupSearch() {
  const searchInputs = document.querySelectorAll(".search-input");

  searchInputs.forEach((input) => {
    input.addEventListener("input", function () {
      const searchTerm = this.value.toLowerCase();
      const table = this.closest(".searchable-table");
      const rows = table.querySelectorAll("tbody tr");

      rows.forEach((row) => {
        const text = row.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
          row.style.display = "";
        } else {
          row.style.display = "none";
        }
      });
    });
  });
}

// Setup print functionality
function setupPrint() {
  const printButtons = document.querySelectorAll(".print-btn");

  printButtons.forEach((button) => {
    button.addEventListener("click", function () {
      window.print();
    });
  });
}

// Start auto-refresh
function startAutoRefresh() {
  // Auto-refresh every 30 seconds for dashboard pages
  if (
    document.querySelector(".dashboard-stats") ||
    document.querySelector(".auto-refresh")
  ) {
    refreshInterval = setInterval(function () {
      refreshDashboard();
    }, 30000);
  }
}

// Refresh dashboard
function refreshDashboard() {
  if (!isOnline) return;

  fetch("/api/dashboard/stats")
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        updateDashboardStats(data.stats);
      }
    })
    .catch((error) => {
      console.error("Error refreshing dashboard:", error);
    });
}

// Update dashboard stats
function updateDashboardStats(stats) {
  // Update stat cards
  Object.keys(stats).forEach((key) => {
    const element = document.querySelector(`[data-stat="${key}"]`);
    if (element) {
      if (key === "today_revenue") {
        element.textContent = `$${parseFloat(stats[key]).toFixed(2)}`;
      } else {
        element.textContent = stats[key];
      }
    }
  });

  // Show refresh notification
  showNotification("Dashboard updated", "info", 2000);
}

// Show notification
function showNotification(message, type = "info", duration = 5000) {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll(
    ".custom-notification"
  );
  existingNotifications.forEach((notification) => notification.remove());

  // Create notification element
  const notification = document.createElement("div");
  notification.className = `custom-notification alert alert-${type} alert-dismissible fade show`;
  notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

  notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

  // Add to page
  document.body.appendChild(notification);

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, duration);
  }
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

// Format date
function formatDate(date, format = "short") {
  const dateObj = new Date(date);

  if (format === "short") {
    return dateObj.toLocaleDateString();
  } else if (format === "long") {
    return dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } else if (format === "time") {
    return dateObj.toLocaleTimeString();
  }

  return dateObj.toLocaleDateString();
}

// Calculate time difference
function timeDifference(from, to) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const diffMs = toDate - fromDate;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

// Validate form data
function validateForm(formData) {
  const errors = [];

  // Check required fields
  formData.forEach((value, key) => {
    if (!value || value.trim() === "") {
      errors.push(`${key} is required`);
    }
  });

  // Validate email format
  const email = formData.get("email");
  if (email && !isValidEmail(email)) {
    errors.push("Invalid email format");
  }

  // Validate phone format
  const phone = formData.get("phone");
  if (phone && !isValidPhone(phone)) {
    errors.push("Invalid phone format");
  }

  return errors;
}

// Validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone
function isValidPhone(phone) {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ""));
}

// Export data to CSV
function exportToCSV(data, filename) {
  const csvContent = convertToCSV(data);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Convert data to CSV
function convertToCSV(data) {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(",")];

  data.forEach((row) => {
    const values = headers.map((header) => {
      const value = row[header];
      return `"${value}"`;
    });
    csvRows.push(values.join(","));
  });

  return csvRows.join("\n");
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function
function throttle(func, limit) {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Local storage utilities
const storage = {
  set: function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Error saving to localStorage:", e);
    }
  },

  get: function (key) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error("Error reading from localStorage:", e);
      return null;
    }
  },

  remove: function (key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error("Error removing from localStorage:", e);
    }
  },

  clear: function () {
    try {
      localStorage.clear();
    } catch (e) {
      console.error("Error clearing localStorage:", e);
    }
  },
};

// Session storage utilities
const session = {
  set: function (key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Error saving to sessionStorage:", e);
    }
  },

  get: function (key) {
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error("Error reading from sessionStorage:", e);
      return null;
    }
  },

  remove: function (key) {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      console.error("Error removing from sessionStorage:", e);
    }
  },

  clear: function () {
    try {
      sessionStorage.clear();
    } catch (e) {
      console.error("Error clearing sessionStorage:", e);
    }
  },
};

// Make functions globally available
window.DigitalParking = {
  showNotification,
  formatCurrency,
  formatDate,
  timeDifference,
  validateForm,
  exportToCSV,
  storage,
  session,
};

// Cleanup on page unload
window.addEventListener("beforeunload", function () {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
