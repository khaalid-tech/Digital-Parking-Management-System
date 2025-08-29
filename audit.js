const { getDatabase } = require("../database/init");

/**
 * Log audit trail for system activities
 * @param {number} userId - ID of the user performing the action
 * @param {string} action - Action being performed (e.g., 'LOGIN', 'CREATE_USER', 'UPDATE_SLOT')
 * @param {string} tableName - Name of the table being affected
 * @param {number} recordId - ID of the record being affected
 * @param {string} oldValues - JSON string of old values (for updates)
 * @param {string} newValues - JSON string of new values
 * @param {string} ipAddress - IP address of the user
 * @param {string} userAgent - User agent string
 */
async function logAudit(
  userId,
  action,
  tableName,
  recordId,
  oldValues,
  newValues,
  ipAddress,
  userAgent
) {
  try {
    const db = getDatabase();

    return new Promise((resolve, reject) => {
      db.run(
        `
        INSERT INTO audit_logs (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          userId,
          action,
          tableName,
          recordId,
          oldValues,
          newValues,
          ipAddress,
          userAgent,
        ],
        function (err) {
          if (err) {
            console.error("Error logging audit:", err);
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  } catch (error) {
    console.error("Audit logging failed:", error);
    // Don't throw error as audit logging should not break main functionality
    return null;
  }
}

/**
 * Get audit logs with filtering options
 * @param {Object} options - Filter options
 * @param {number} options.userId - Filter by specific user
 * @param {string} options.action - Filter by specific action
 * @param {string} options.tableName - Filter by specific table
 * @param {string} options.startDate - Start date for filtering
 * @param {string} options.endDate - End date for filtering
 * @param {number} options.limit - Maximum number of records to return
 * @param {number} options.offset - Offset for pagination
 */
async function getAuditLogs(options = {}) {
  try {
    const db = getDatabase();

    let query = `
      SELECT 
        al.*,
        u.username,
        u.full_name as user_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (options.userId) {
      query += " AND al.user_id = ?";
      params.push(options.userId);
    }

    if (options.action) {
      query += " AND al.action = ?";
      params.push(options.action);
    }

    if (options.tableName) {
      query += " AND al.table_name = ?";
      params.push(options.tableName);
    }

    if (options.startDate) {
      query += " AND DATE(al.created_at) >= ?";
      params.push(options.startDate);
    }

    if (options.endDate) {
      query += " AND DATE(al.created_at) <= ?";
      params.push(options.endDate);
    }

    query += " ORDER BY al.created_at DESC";

    if (options.limit) {
      query += " LIMIT ?";
      params.push(options.limit);

      if (options.offset) {
        query += " OFFSET ?";
        params.push(options.offset);
      }
    }

    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) {
          console.error("Error fetching audit logs:", err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    throw error;
  }
}

/**
 * Get audit log statistics
 * @param {string} startDate - Start date for statistics
 * @param {string} endDate - End date for statistics
 */
async function getAuditStats(startDate, endDate) {
  try {
    const db = getDatabase();

    return new Promise((resolve, reject) => {
      db.get(
        `
        SELECT 
          COUNT(*) as total_actions,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT action) as unique_actions,
          COUNT(DISTINCT table_name) as unique_tables
        FROM audit_logs
        WHERE DATE(created_at) BETWEEN ? AND ?
      `,
        [startDate, endDate],
        (err, row) => {
          if (err) {
            console.error("Error fetching audit stats:", err);
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  } catch (error) {
    console.error("Failed to fetch audit stats:", error);
    throw error;
  }
}

/**
 * Get most common actions
 * @param {number} limit - Maximum number of actions to return
 */
async function getMostCommonActions(limit = 10) {
  try {
    const db = getDatabase();

    return new Promise((resolve, reject) => {
      db.all(
        `
        SELECT 
          action,
          COUNT(*) as count
        FROM audit_logs
        GROUP BY action
        ORDER BY count DESC
        LIMIT ?
      `,
        [limit],
        (err, rows) => {
          if (err) {
            console.error("Error fetching common actions:", err);
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  } catch (error) {
    console.error("Failed to fetch common actions:", error);
    throw error;
  }
}

/**
 * Get user activity summary
 * @param {string} startDate - Start date for summary
 * @param {string} endDate - End date for summary
 */
async function getUserActivitySummary(startDate, endDate) {
  try {
    const db = getDatabase();

    return new Promise((resolve, reject) => {
      db.all(
        `
        SELECT 
          u.username,
          u.full_name,
          COUNT(al.id) as action_count,
          COUNT(DISTINCT DATE(al.created_at)) as active_days,
          MIN(al.created_at) as first_action,
          MAX(al.created_at) as last_action
        FROM users u
        LEFT JOIN audit_logs al ON u.id = al.user_id
        WHERE DATE(al.created_at) BETWEEN ? AND ?
        GROUP BY u.id, u.username, u.full_name
        ORDER BY action_count DESC
      `,
        [startDate, endDate],
        (err, rows) => {
          if (err) {
            console.error("Error fetching user activity summary:", err);
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  } catch (error) {
    console.error("Failed to fetch user activity summary:", error);
    throw error;
  }
}

/**
 * Clean old audit logs (for maintenance)
 * @param {number} daysOld - Delete logs older than this many days
 */
async function cleanOldAuditLogs(daysOld = 90) {
  try {
    const db = getDatabase();

    return new Promise((resolve, reject) => {
      db.run(
        `
        DELETE FROM audit_logs 
        WHERE created_at < datetime('now', '-${daysOld} days')
      `,
        function (err) {
          if (err) {
            console.error("Error cleaning old audit logs:", err);
            reject(err);
          } else {
            console.log(`Cleaned ${this.changes} old audit log entries`);
            resolve(this.changes);
          }
        }
      );
    });
  } catch (error) {
    console.error("Failed to clean old audit logs:", error);
    throw error;
  }
}

module.exports = {
  logAudit,
  getAuditLogs,
  getAuditStats,
  getMostCommonActions,
  getUserActivitySummary,
  cleanOldAuditLogs,
};
