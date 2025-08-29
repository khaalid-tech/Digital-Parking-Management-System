const express = require("express");
const { getDatabase } = require("../database/init");
const { logAudit } = require("../utils/audit");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Apply authentication middleware to all API routes
router.use(requireAuth);

// Get parking slots status
router.get("/slots/status", async (req, res) => {
  try {
    const db = getDatabase();

    const slots = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT 
          id, slot_number, slot_name, status, slot_type, hourly_rate, daily_rate
        FROM parking_slots
        ORDER BY slot_number
      `,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ success: true, slots });
  } catch (error) {
    console.error("API slots status error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch slots status" });
  }
});

// Get dashboard statistics
router.get("/dashboard/stats", async (req, res) => {
  try {
    const db = getDatabase();

    const stats = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT 
          (SELECT COUNT(*) FROM parking_slots WHERE status = 'vacant') as vacant_slots,
          (SELECT COUNT(*) FROM parking_slots WHERE status = 'occupied') as occupied_slots,
          (SELECT COUNT(*) FROM parking_slots WHERE status = 'reserved') as reserved_slots,
          (SELECT COUNT(*) FROM parking_slots WHERE status = 'out_of_service') as out_of_service_slots,
          (SELECT COUNT(*) FROM parking_tickets WHERE DATE(check_in_time) = DATE('now')) as today_tickets,
          (SELECT COUNT(*) FROM parking_tickets WHERE DATE(check_in_time) = DATE('now') AND payment_status = 'paid') as today_paid,
          (SELECT COUNT(*) FROM parking_tickets WHERE DATE(check_in_time) = DATE('now') AND payment_status = 'pending') as today_pending
      `,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    // Get today's revenue
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
          else resolve(row);
        }
      );
    });

    res.json({
      success: true,
      stats: { ...stats, today_revenue: todayRevenue.total_revenue },
    });
  } catch (error) {
    console.error("API dashboard stats error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch dashboard statistics" });
  }
});

// Search vehicles by license plate
router.get("/vehicles/search", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, vehicles: [] });
    }

    const db = getDatabase();

    const vehicles = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT 
          id, license_plate, make, model, color, year, owner_name, owner_phone
        FROM vehicles
        WHERE license_plate LIKE ? OR owner_name LIKE ? OR owner_phone LIKE ?
        ORDER BY created_at DESC
        LIMIT 10
      `,
        [`%${q}%`, `%${q}%`, `%${q}%`],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ success: true, vehicles });
  } catch (error) {
    console.error("API vehicle search error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to search vehicles" });
  }
});

// Search drivers by name or phone
router.get("/drivers/search", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json({ success: true, drivers: [] });
    }

    const db = getDatabase();

    const drivers = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT 
          id, full_name, phone, email, id_number, license_number
        FROM drivers
        WHERE full_name LIKE ? OR phone LIKE ? OR id_number LIKE ? OR license_number LIKE ?
        ORDER BY created_at DESC
        LIMIT 10
      `,
        [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ success: true, drivers });
  } catch (error) {
    console.error("API driver search error:", error);
    res.status(500).json({ success: false, error: "Failed to search drivers" });
  }
});

// Get ticket details for check-out
router.get("/tickets/:id/checkout", async (req, res) => {
  try {
    const db = getDatabase();

    const ticket = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT 
          pt.*,
          ps.slot_number,
          ps.slot_name,
          ps.hourly_rate,
          ps.daily_rate,
          v.license_plate,
          v.make,
          v.model,
          v.color,
          d.full_name as driver_name,
          d.phone as driver_phone
        FROM parking_tickets pt
        JOIN parking_slots ps ON pt.slot_id = ps.id
        JOIN vehicles v ON pt.vehicle_id = v.id
        JOIN drivers d ON pt.driver_id = d.id
        WHERE pt.id = ?
      `,
        [req.params.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, error: "Ticket not found" });
    }

    // Calculate duration and cost
    const checkInTime = new Date(ticket.check_in_time);
    const now = new Date();
    const durationHours = (now - checkInTime) / (1000 * 60 * 60);
    const totalCost = Math.ceil(durationHours) * ticket.hourly_rate;

    res.json({
      success: true,
      ticket: {
        ...ticket,
        duration_hours: durationHours.toFixed(2),
        total_cost: totalCost,
      },
    });
  } catch (error) {
    console.error("API ticket checkout error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch ticket details" });
  }
});

// Get recent activities
router.get("/activities/recent", async (req, res) => {
  try {
    const db = getDatabase();

    const activities = await new Promise((resolve, reject) => {
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
        LIMIT 20
      `,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ success: true, activities });
  } catch (error) {
    console.error("API recent activities error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch recent activities" });
  }
});

// Get shift summary
router.get("/shift/summary", async (req, res) => {
  try {
    const db = getDatabase();

    // Get current shift
    const currentShift = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT * FROM shifts 
        WHERE cashier_id = ? AND shift_date = DATE('now') AND status = 'open'
        ORDER BY open_time DESC LIMIT 1
      `,
        [req.session.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!currentShift) {
      return res.json({ success: true, shift: null, summary: null });
    }

    // Get shift summary
    const summary = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT 
          COUNT(pt.id) as total_tickets,
          SUM(CASE WHEN pt.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_tickets,
          SUM(CASE WHEN pt.payment_status = 'pending' THEN 1 ELSE 0 END) as pending_tickets,
          COALESCE(SUM(p.amount), 0) as total_collected
        FROM parking_tickets pt
        LEFT JOIN payments p ON pt.id = p.ticket_id
        WHERE pt.cashier_id = ? AND DATE(pt.check_in_time) = DATE('now')
      `,
        [req.session.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    res.json({ success: true, shift: currentShift, summary });
  } catch (error) {
    console.error("API shift summary error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch shift summary" });
  }
});

// Update slot status
router.put("/slots/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const slotId = req.params.id;

    if (
      !["vacant", "occupied", "reserved", "out_of_service"].includes(status)
    ) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    const db = getDatabase();

    // Get old status for audit
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

    if (!oldSlot) {
      return res.status(404).json({ success: false, error: "Slot not found" });
    }

    // Update slot status
    db.run(
      `
      UPDATE parking_slots 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [status, slotId],
      async function (err) {
        if (err) {
          console.error("Error updating slot status:", err);
          return res
            .status(500)
            .json({ success: false, error: "Failed to update slot status" });
        }

        // Log the status change
        await logAudit(
          req.session.user.id,
          "UPDATE_SLOT_STATUS",
          "parking_slots",
          slotId,
          JSON.stringify(oldSlot),
          JSON.stringify({ status }),
          req.ip,
          req.get("User-Agent")
        );

        res.json({
          success: true,
          message: "Slot status updated successfully",
        });
      }
    );
  } catch (error) {
    console.error("API update slot status error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to update slot status" });
  }
});

// Get parking rates
router.get("/rates", async (req, res) => {
  try {
    const db = getDatabase();

    const rates = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT slot_type, hourly_rate, daily_rate
        FROM parking_slots
        GROUP BY slot_type, hourly_rate, daily_rate
        ORDER BY slot_type
      `,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ success: true, rates });
  } catch (error) {
    console.error("API rates error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch parking rates" });
  }
});

// Get daily summary
router.get("/summary/daily", async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split("T")[0];

    const db = getDatabase();

    const summary = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT 
          COUNT(pt.id) as total_tickets,
          SUM(CASE WHEN pt.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_tickets,
          SUM(CASE WHEN pt.payment_status = 'pending' THEN 1 ELSE 0 END) as pending_tickets,
          COALESCE(SUM(p.amount), 0) as total_revenue,
          COUNT(DISTINCT pt.cashier_id) as active_cashiers
        FROM parking_tickets pt
        LEFT JOIN payments p ON pt.id = p.ticket_id
        WHERE DATE(pt.check_in_time) = ?
      `,
        [targetDate],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    res.json({ success: true, summary, date: targetDate });
  } catch (error) {
    console.error("API daily summary error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch daily summary" });
  }
});

// Export data to JSON
router.get("/export/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Start date and end date are required",
        });
    }

    const db = getDatabase();
    let data = null;

    switch (type) {
      case "tickets":
        data = await new Promise((resolve, reject) => {
          db.all(
            `
            SELECT 
              pt.*,
              ps.slot_number,
              ps.slot_name,
              v.license_plate,
              v.make,
              v.model,
              v.color,
              d.full_name as driver_name,
              d.phone as driver_phone,
              u.full_name as cashier_name
            FROM parking_tickets pt
            JOIN parking_slots ps ON pt.slot_id = ps.id
            JOIN vehicles v ON pt.vehicle_id = v.id
            JOIN drivers d ON pt.driver_id = d.id
            JOIN users u ON pt.cashier_id = u.id
            WHERE DATE(pt.check_in_time) BETWEEN ? AND ?
            ORDER BY pt.check_in_time DESC
          `,
            [start_date, end_date],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            }
          );
        });
        break;

      case "payments":
        data = await new Promise((resolve, reject) => {
          db.all(
            `
            SELECT 
              p.*,
              pt.ticket_number,
              pt.check_in_time,
              pt.check_out_time,
              ps.slot_number,
              v.license_plate,
              d.full_name as driver_name,
              u.full_name as cashier_name
            FROM payments p
            JOIN parking_tickets pt ON p.ticket_id = pt.id
            JOIN parking_slots ps ON pt.slot_id = ps.id
            JOIN vehicles v ON pt.vehicle_id = v.id
            JOIN drivers d ON pt.driver_id = d.id
            JOIN users u ON p.cashier_id = u.id
            WHERE DATE(p.payment_date) BETWEEN ? AND ?
            ORDER BY p.payment_date DESC
          `,
            [start_date, end_date],
            (err, rows) => {
              if (err) reject(err);
              else resolve(rows);
            }
          );
        });
        break;

      default:
        return res
          .status(400)
          .json({ success: false, error: "Invalid export type" });
    }

    res.json({ success: true, data, type, start_date, end_date });
  } catch (error) {
    console.error("API export error:", error);
    res.status(500).json({ success: false, error: "Failed to export data" });
  }
});

module.exports = router;
