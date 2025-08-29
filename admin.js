const express = require("express");
const { getDatabase } = require("../database/init");
const { logAudit } = require("../utils/audit");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const moment = require("moment");

const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(requireAuth);
router.use(requireAdmin);

// Admin dashboard
router.get("/dashboard", async (req, res) => {
  try {
    const db = getDatabase();

    // Get dashboard statistics with default values
    const stats = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT 
          COALESCE((SELECT COUNT(*) FROM parking_slots WHERE status = 'vacant'), 0) as vacant_slots,
          COALESCE((SELECT COUNT(*) FROM parking_slots WHERE status = 'occupied'), 0) as occupied_slots,
          COALESCE((SELECT COUNT(*) FROM parking_slots WHERE status = 'reserved'), 0) as reserved_slots,
          COALESCE((SELECT COUNT(*) FROM parking_slots WHERE status = 'out_of_service'), 0) as out_of_service_slots,
          COALESCE((SELECT COUNT(*) FROM parking_tickets WHERE DATE(check_in_time) = DATE('now')), 0) as today_tickets,
          COALESCE((SELECT COUNT(*) FROM parking_tickets WHERE DATE(check_in_time) = DATE('now') AND payment_status = 'paid'), 0) as today_paid,
          COALESCE((SELECT COUNT(*) FROM parking_tickets WHERE DATE(check_in_time) = DATE('now') AND payment_status = 'pending'), 0) as today_pending
      `,
        (err, row) => {
          if (err) reject(err);
          else
            resolve(
              row || {
                vacant_slots: 0,
                occupied_slots: 0,
                reserved_slots: 0,
                out_of_service_slots: 0,
                today_tickets: 0,
                today_paid: 0,
                today_pending: 0,
              }
            );
        }
      );
    });

    // Get recent activities with default empty array
    const recentActivities = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT 
          al.action,
          al.created_at,
          u.full_name as user_name,
          al.table_name,
          al.record_id
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 10
      `,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    // Get today's revenue with default 0
    const todayRevenue = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT COALESCE(SUM(p.amount), 0) as total_revenue
        FROM payments p
        JOIN parking_tickets pt ON p.ticket_id = pt.id
        WHERE DATE(p.payment_date) = DATE('now')
      `,
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.total_revenue : 0);
        }
      );
    });

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      stats,
      recentActivities,
      todayRevenue: todayRevenue || 0,
      user: req.session.user,
      moment: moment,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    // Provide default values if there's an error
    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      stats: {
        vacant_slots: 0,
        occupied_slots: 0,
        reserved_slots: 0,
        out_of_service_slots: 0,
        today_tickets: 0,
        today_paid: 0,
        today_pending: 0,
      },
      recentActivities: [],
      todayRevenue: 0,
      user: req.session.user,
      moment: moment,
    });
  }
});

// User management
router.get("/users", async (req, res) => {
  try {
    const db = getDatabase();

    const users = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT id, username, full_name, role, email, phone, is_active, created_at
        FROM users
        ORDER BY created_at DESC
      `,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    res.render("admin/users", {
      title: "User Management",
      users,
      user: req.session.user,
      currentUser: req.session.user,
      moment: moment,
    });
  } catch (error) {
    console.error("Users error:", error);
    // Provide default values if there's an error
    res.render("admin/users", {
      title: "User Management",
      users: [],
      user: req.session.user,
      currentUser: req.session.user,
      moment: moment,
    });
  }
});

// Add user page
router.get("/users/add", (req, res) => {
  res.render("admin/user-form", {
    title: "Add New User",
    user: null,
    currentUser: req.session.user,
  });
});

// Add user process
router.post("/users/add", async (req, res) => {
  const { username, password, full_name, role, email, phone } = req.body;

  if (!username || !password || !full_name || !role) {
    return res.redirect("/admin/users/add?error=Required fields are missing");
  }

  try {
    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash(password, 10);

    const db = getDatabase();
    db.run(
      `
      INSERT INTO users (username, password, full_name, role, email, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      [username, hashedPassword, full_name, role, email, phone],
      async function (err) {
        if (err) {
          console.error("Error adding user:", err);
          return res.redirect("/admin/users/add?error=Failed to add user");
        }

        await logAudit(
          req.session.user.id,
          "CREATE_USER",
          "users",
          this.lastID,
          null,
          JSON.stringify(req.body),
          req.ip,
          req.get("User-Agent")
        );
        res.redirect("/admin/users?success=User added successfully");
      }
    );
  } catch (error) {
    console.error("Add user error:", error);
    res.redirect("/admin/users/add?error=System error occurred");
  }
});

// Edit user page
router.get("/users/edit/:id", async (req, res) => {
  try {
    const db = getDatabase();

    const user = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM users WHERE id = ?",
        [req.params.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) {
      return res.status(404).render("error", {
        title: "User Not Found",
        error: {},
        message: "The requested user does not exist.",
      });
    }

    res.render("admin/user-form", {
      title: "Edit User",
      user,
      currentUser: req.session.user,
    });
  } catch (error) {
    console.error("Edit user error:", error);
    res.status(500).render("error", {
      title: "Error",
      error: {},
      message: "Failed to load user",
    });
  }
});

// Update user process
router.post("/users/edit/:id", async (req, res) => {
  const { username, full_name, role, email, phone, is_active } = req.body;
  const userId = req.params.id;

  if (!username || !full_name || !role) {
    return res.redirect(
      `/admin/users/edit/${userId}?error=Required fields are missing`
    );
  }

  try {
    const db = getDatabase();

    // Get old values for audit
    const oldUser = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE id = ?", [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    db.run(
      `
      UPDATE users 
      SET username = ?, full_name = ?, role = ?, email = ?, phone = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [username, full_name, role, email, phone, is_active ? 1 : 0, userId],
      async function (err) {
        if (err) {
          console.error("Error updating user:", err);
          return res.redirect(
            `/admin/users/edit/${userId}?error=Failed to update user`
          );
        }

        await logAudit(
          req.session.user.id,
          "UPDATE_USER",
          "users",
          userId,
          JSON.stringify(oldUser),
          JSON.stringify(req.body),
          req.ip,
          req.get("User-Agent")
        );
        res.redirect("/admin/users?success=User updated successfully");
      }
    );
  } catch (error) {
    console.error("Update user error:", error);
    res.redirect(`/admin/users/edit/${userId}?error=System error occurred`);
  }
});

// Delete user
router.post("/users/delete/:id", async (req, res) => {
  const userId = req.params.id;

  try {
    const db = getDatabase();

    // Check if user exists
    const user = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE id = ?", [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.redirect("/admin/users?error=User not found");
    }

    // Prevent admin from deleting themselves
    if (parseInt(userId) === req.session.user.id) {
      return res.redirect(
        "/admin/users?error=You cannot delete your own account"
      );
    }

    // Check if user has any associated records in multiple tables
    const checks = await Promise.all([
      // Check parking tickets
      new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM parking_tickets WHERE cashier_id = ?",
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.count : 0);
          }
        );
      }),
      // Check payments
      new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM payments WHERE cashier_id = ?",
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.count : 0);
          }
        );
      }),
      // Check shifts
      new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM shifts WHERE cashier_id = ?",
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.count : 0);
          }
        );
      }),
      // Check audit logs
      new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM audit_logs WHERE user_id = ?",
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row ? row.count : 0);
          }
        );
      }),
    ]);

    const [tickets, payments, shifts, auditLogs] = checks;
    const totalReferences = tickets + payments + shifts + auditLogs;

    if (totalReferences > 0) {
      // Check if this is a force delete request
      if (req.body.force_delete === 'true') {
        try {
          // Force delete: Clean up all associated records first
          await Promise.all([
            // Delete parking tickets
            new Promise((resolve, reject) => {
              db.run("DELETE FROM parking_tickets WHERE cashier_id = ?", [userId], (err) => {
                if (err) reject(err);
                else resolve();
              });
            }),
            // Delete payments
            new Promise((resolve, reject) => {
              db.run("DELETE FROM payments WHERE cashier_id = ?", [userId], (err) => {
                if (err) reject(err);
                else resolve();
              });
            }),
            // Delete shifts
            new Promise((resolve, reject) => {
              db.run("DELETE FROM shifts WHERE cashier_id = ?", [userId], (err) => {
                if (err) reject(err);
                else resolve();
              });
            }),
            // Delete audit logs
            new Promise((resolve, reject) => {
              db.run("DELETE FROM audit_logs WHERE user_id = ?", [userId], (err) => {
                if (err) reject(err);
                else resolve();
              });
            })
          ]);
          
          console.log(`Force deleted user ${userId} and cleaned up ${totalReferences} associated records`);
        } catch (cleanupError) {
          console.error("Error during force delete cleanup:", cleanupError);
          return res.redirect("/admin/users?error=Failed to clean up associated records during force delete");
        }
      } else {
        // Regular delete attempt - show what needs to be cleaned up
        let errorMessage = "User has associated records and cannot be deleted: ";
        const issues = [];
        if (tickets > 0) issues.push(`${tickets} parking ticket(s)`);
        if (payments > 0) issues.push(`${payments} payment(s)`);
        if (shifts > 0) issues.push(`${shifts} shift(s)`);
        if (auditLogs > 0) issues.push(`${auditLogs} audit log(s)`);
        
        errorMessage += issues.join(", ");
        errorMessage += ". Use force delete to remove all associated records.";
        return res.redirect(`/admin/users?error=${encodeURIComponent(errorMessage)}`);
      }
    }

    // Delete the user
    db.run("DELETE FROM users WHERE id = ?", [userId], async function (err) {
      if (err) {
        console.error("Error deleting user:", err);
        return res.redirect("/admin/users?error=Failed to delete user");
      }

      // Log the deletion
      await logAudit(
        req.session.user.id,
        "DELETE_USER",
        "users",
        userId,
        JSON.stringify(user),
        null,
        req.ip,
        req.get("User-Agent")
      );

      res.redirect("/admin/users?success=User deleted successfully");
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.redirect("/admin/users?error=System error occurred");
  }
});

// Parking slot management
router.get("/slots", async (req, res) => {
  try {
    const db = getDatabase();

    const slots = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT id, slot_number, slot_name, status, slot_type, hourly_rate, daily_rate, created_at
        FROM parking_slots
        ORDER BY slot_number
      `,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    res.render("admin/slots", {
      title: "Parking Slots Management",
      slots,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Slots error:", error);
    // Provide default values if there's an error
    res.render("admin/slots", {
      title: "Parking Slots Management",
      slots: [],
      user: req.session.user,
    });
  }
});

// Add slot page
router.get("/slots/add", (req, res) => {
  res.render("admin/slot-form", {
    title: "Add New Parking Slot",
    slot: null,
    currentUser: req.session.user,
  });
});

// Add slot process
router.post("/slots/add", async (req, res) => {
  const { slot_number, slot_name, slot_type, hourly_rate, daily_rate } =
    req.body;

  if (!slot_number || !slot_name) {
    return res.redirect("/admin/slots/add?error=Required fields are missing");
  }

  try {
    const db = getDatabase();
    db.run(
      `
      INSERT INTO parking_slots (slot_number, slot_name, slot_type, hourly_rate, daily_rate)
      VALUES (?, ?, ?, ?, ?)
    `,
      [
        slot_number,
        slot_name,
        slot_type,
        hourly_rate || 5.0,
        daily_rate || 50.0,
      ],
      async function (err) {
        if (err) {
          console.error("Error adding slot:", err);
          return res.redirect("/admin/slots/add?error=Failed to add slot");
        }

        await logAudit(
          req.session.user.id,
          "CREATE_SLOT",
          "parking_slots",
          this.lastID,
          null,
          JSON.stringify(req.body),
          req.ip,
          req.get("User-Agent")
        );
        res.redirect("/admin/slots?success=Parking slot added successfully");
      }
    );
  } catch (error) {
    console.error("Add slot error:", error);
    res.redirect("/admin/slots/add?error=System error occurred");
  }
});

// Edit slot page
router.get("/slots/edit/:id", async (req, res) => {
  try {
    const db = getDatabase();

    const slot = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM parking_slots WHERE id = ?",
        [req.params.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!slot) {
      return res.status(404).render("error", {
        title: "Slot Not Found",
        error: {},
        message: "The requested parking slot does not exist.",
      });
    }

    res.render("admin/slot-form", {
      title: "Edit Parking Slot",
      slot,
      currentUser: req.session.user,
    });
  } catch (error) {
    console.error("Edit slot error:", error);
    res.status(500).render("error", {
      title: "Error",
      error: {},
      message: "Failed to load parking slot",
    });
  }
});

// Update slot process
router.post("/slots/edit/:id", async (req, res) => {
  const { slot_number, slot_name, slot_type, hourly_rate, daily_rate, status } =
    req.body;
  const slotId = req.params.id;

  if (!slot_number || !slot_name) {
    return res.redirect(
      `/admin/slots/edit/${slotId}?error=Required fields are missing`
    );
  }

  try {
    const db = getDatabase();

    // Get old values for audit
    const oldSlot = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM parking_slots WHERE id = ?",
        [slotId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    db.run(
      `
      UPDATE parking_slots 
      SET slot_number = ?, slot_name = ?, slot_type = ?, hourly_rate = ?, daily_rate = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [
        slot_number,
        slot_name,
        slot_type,
        hourly_rate,
        daily_rate,
        status,
        slotId,
      ],
      async function (err) {
        if (err) {
          console.error("Error updating slot:", err);
          return res.redirect(
            `/admin/slots/edit/${slotId}?error=Failed to update slot`
          );
        }

        await logAudit(
          req.session.user.id,
          "UPDATE_SLOT",
          "parking_slots",
          slotId,
          JSON.stringify(oldSlot),
          JSON.stringify(req.body),
          req.ip,
          req.get("User-Agent")
        );
        res.redirect("/admin/slots?success=Parking slot updated successfully");
      }
    );
  } catch (error) {
    console.error("Update slot error:", error);
    res.redirect(`/admin/slots/edit/${slotId}?error=System error occurred`);
  }
});

// Reports
router.get("/reports", async (req, res) => {
  try {
    const db = getDatabase();
    const { start_date, end_date, report_type } = req.query;

    let reportData = null;

    if (start_date && end_date && report_type) {
      switch (report_type) {
        case "daily":
          reportData = await new Promise((resolve, reject) => {
            db.all(
              `
              SELECT 
                DATE(pt.check_in_time) as date,
                COUNT(*) as total_tickets,
                SUM(CASE WHEN pt.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_tickets,
                SUM(CASE WHEN pt.payment_status = 'pending' THEN 1 ELSE 0 END) as pending_tickets,
                COALESCE(SUM(p.amount), 0) as total_revenue
              FROM parking_tickets pt
              LEFT JOIN payments p ON pt.id = p.ticket_id
              WHERE DATE(pt.check_in_time) BETWEEN ? AND ?
              GROUP BY DATE(pt.check_in_time)
              ORDER BY date DESC
            `,
              [start_date, end_date],
              (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
              }
            );
          });
          break;

        case "monthly":
          reportData = await new Promise((resolve, reject) => {
            db.all(
              `
              SELECT 
                strftime('%Y-%m', pt.check_in_time) as month,
                COUNT(*) as total_tickets,
                SUM(CASE WHEN pt.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_tickets,
                SUM(CASE WHEN pt.payment_status = 'pending' THEN 1 ELSE 0 END) as pending_tickets,
                COALESCE(SUM(p.amount), 0) as total_revenue
              FROM parking_tickets pt
              LEFT JOIN payments p ON pt.id = p.ticket_id
              WHERE DATE(pt.check_in_time) BETWEEN ? AND ?
              GROUP BY strftime('%Y-%m', pt.check_in_time)
              ORDER BY month DESC
            `,
              [start_date, end_date],
              (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
              }
            );
          });
          break;

        case "cashier":
          reportData = await new Promise((resolve, reject) => {
            db.all(
              `
              SELECT 
                u.full_name as cashier_name,
                COUNT(pt.id) as total_tickets,
                COALESCE(SUM(p.amount), 0) as total_collected,
                COUNT(DISTINCT DATE(pt.check_in_time)) as working_days
              FROM users u
              LEFT JOIN parking_tickets pt ON u.id = pt.cashier_id
              LEFT JOIN payments p ON pt.id = p.ticket_id
              WHERE u.role = 'cashier' AND DATE(pt.check_in_time) BETWEEN ? AND ?
              GROUP BY u.id, u.full_name
              ORDER BY total_collected DESC
            `,
              [start_date, end_date],
              (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
              }
            );
          });
          break;
      }
    }

    res.render("admin/reports", {
      title: "Reports",
      reportData,
      reportType: report_type,
      startDate: start_date,
      endDate: end_date,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Reports error:", error);
    // Provide default values if there's an error
    res.render("admin/reports", {
      title: "Reports",
      reportData: [],
      reportType: null,
      startDate: null,
      endDate: null,
      user: req.session.user,
    });
  }
});

// Export report to CSV
router.get("/reports/export/:type", async (req, res) => {
  const { start_date, end_date } = req.query;
  const reportType = req.params.type;

  if (!start_date || !end_date) {
    return res.status(400).send("Start date and end date are required");
  }

  try {
    const db = getDatabase();
    let csvData = "";

    switch (reportType) {
      case "daily":
        const dailyData = await new Promise((resolve, reject) => {
          db.all(
            `
            SELECT 
              DATE(pt.check_in_time) as date,
              COUNT(*) as total_tickets,
              SUM(CASE WHEN pt.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_tickets,
              SUM(CASE WHEN pt.payment_status = 'pending' THEN 1 ELSE 0 END) as pending_tickets,
              COALESCE(SUM(p.amount), 0) as total_revenue
            FROM parking_tickets pt
            LEFT JOIN payments p ON pt.id = p.ticket_id
            WHERE DATE(pt.check_in_time) BETWEEN ? AND ?
            GROUP BY DATE(pt.check_in_time)
            ORDER BY date DESC
          `,
            [start_date, end_date],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });

        csvData =
          "Date,Total Tickets,Paid Tickets,Pending Tickets,Total Revenue\n";
        dailyData.forEach((row) => {
          csvData += `${row.date},${row.total_tickets},${row.total_paid},${row.pending_tickets},${row.total_revenue}\n`;
        });
        break;

      case "monthly":
        const monthlyData = await new Promise((resolve, reject) => {
          db.all(
            `
            SELECT 
              strftime('%Y-%m', pt.check_in_time) as month,
              COUNT(*) as total_tickets,
              SUM(CASE WHEN pt.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_tickets,
              SUM(CASE WHEN pt.payment_status = 'pending' THEN 1 ELSE 0 END) as pending_tickets,
              COALESCE(SUM(p.amount), 0) as total_revenue
            FROM parking_tickets pt
            LEFT JOIN payments p ON pt.id = p.ticket_id
            WHERE DATE(pt.check_in_time) BETWEEN ? AND ?
            GROUP BY strftime('%Y-%m', pt.check_in_time)
            ORDER BY month DESC
          `,
            [start_date, end_date],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });

        csvData =
          "Month,Total Tickets,Paid Tickets,Pending Tickets,Total Revenue\n";
        monthlyData.forEach((row) => {
          csvData += `${row.month},${row.total_tickets},${row.paid_tickets},${row.pending_tickets},${row.total_revenue}\n`;
        });
        break;

      case "cashier":
        const cashierData = await new Promise((resolve, reject) => {
          db.all(
            `
            SELECT 
              u.full_name as cashier_name,
              COUNT(pt.id) as total_tickets,
              COALESCE(SUM(p.amount), 0) as total_collected,
              COUNT(DISTINCT DATE(pt.check_in_time)) as working_days
            FROM users u
            LEFT JOIN parking_tickets pt ON u.id = pt.cashier_id
            LEFT JOIN payments p ON pt.id = p.ticket_id
            WHERE u.role = 'cashier' AND DATE(pt.check_in_time) BETWEEN ? AND ?
            GROUP BY u.id, u.full_name
            ORDER BY total_collected DESC
          `,
            [start_date, end_date],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            }
          );
        });

        csvData = "Cashier Name,Total Tickets,Total Collected,Working Days\n";
        cashierData.forEach((row) => {
          csvData += `${row.cashier_name},${row.total_tickets},${row.total_collected},${row.working_days}\n`;
        });
        break;

      default:
        return res.status(400).send("Invalid report type");
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${reportType}_report_${start_date}_to_${end_date}.csv`
    );
    res.send(csvData);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).send("Failed to export report");
  }
});

// System settings
router.get("/settings", (req, res) => {
  res.render("admin/settings", {
    title: "System Settings",
    user: req.session.user,
  });
});

module.exports = router;
