const express = require("express");
const { getDatabase } = require("../database/init");
const { logAudit } = require("../utils/audit");
const { requireAuth, requireCashier } = require("../middleware/auth");
const moment = require("moment");

const router = express.Router();

// Apply authentication middleware to all cashier routes
router.use(requireAuth);
router.use(requireCashier);

// Cashier dashboard
router.get("/dashboard", async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.session.user) {
      return res.redirect("/auth/login");
    }

    // Check if user is a cashier
    if (req.session.user.role !== "cashier") {
      return res.status(403).render("error", {
        title: "Access Denied",
        error: {},
        message:
          "You do not have permission to access this page. Cashier access required.",
      });
    }

    const db = getDatabase();

    // Get current shift with default null
    let currentShift = null;
    try {
      currentShift = await new Promise((resolve, reject) => {
        db.get(
          `
          SELECT * FROM shifts 
          WHERE cashier_id = ? AND shift_date = DATE('now') AND status = 'open'
          ORDER BY open_time DESC LIMIT 1
        `,
          [req.session.user.id],
          (err, row) => {
            if (err) {
              console.error("Error fetching shift:", err);
              resolve(null);
            } else {
              resolve(row || null);
            }
          }
        );
      });
    } catch (shiftError) {
      console.error("Shift fetch error:", shiftError);
      currentShift = null;
    }

    // Get recent tickets for this cashier with default empty array
    let recentTickets = [];
    try {
      recentTickets = await new Promise((resolve, reject) => {
        db.all(
          `
          SELECT 
            pt.id,
            pt.ticket_number,
            pt.check_in_time,
            pt.payment_status,
            pt.total_amount,
            ps.slot_number,
            ps.slot_name,
            v.license_plate
          FROM parking_tickets pt
          LEFT JOIN parking_slots ps ON pt.slot_id = ps.id
          LEFT JOIN vehicles v ON pt.vehicle_id = v.id
          WHERE pt.cashier_id = ? 
          ORDER BY pt.check_in_time DESC
          LIMIT 10
        `,
          [req.session.user.id],
          (err, rows) => {
            if (err) {
              console.error("Error fetching recent tickets:", err);
              resolve([]);
            } else {
              resolve(rows || []);
            }
          }
        );
      });
    } catch (ticketsError) {
      console.error("Recent tickets fetch error:", ticketsError);
      recentTickets = [];
    }

    // Get available slots with default empty array
    let availableSlots = [];
    try {
      availableSlots = await new Promise((resolve, reject) => {
        db.all(
          `
          SELECT * FROM parking_slots 
          WHERE status = 'vacant' AND slot_type != 'out_of_service'
          ORDER BY slot_number
        `,
          (err, rows) => {
            if (err) {
              console.error("Error fetching available slots:", err);
              resolve([]);
            } else {
              resolve(rows || []);
            }
          }
        );
      });
    } catch (slotsError) {
      console.error("Available slots fetch error:", slotsError);
      availableSlots = [];
    }

    // Get pending payments with default empty array
    let pendingPayments = [];
    try {
      pendingPayments = await new Promise((resolve, reject) => {
        db.all(
          `
          SELECT 
            pt.id,
            pt.ticket_number,
            pt.check_in_time,
            pt.total_amount,
            ps.slot_number
          FROM parking_tickets pt
          LEFT JOIN parking_slots ps ON pt.slot_id = ps.id
          WHERE pt.payment_status = 'pending'
          ORDER BY pt.check_in_time ASC
        `,
          (err, rows) => {
            if (err) {
              console.error("Error fetching pending payments:", err);
              resolve([]);
            } else {
              resolve(rows || []);
            }
          }
        );
      });
    } catch (paymentsError) {
      console.error("Pending payments fetch error:", paymentsError);
      pendingPayments = [];
    }

    // Calculate dashboard stats
    const stats = {
      vacant_slots: availableSlots.length,
      occupied_slots: 0,
      today_tickets: recentTickets.length,
      today_pending: pendingPayments.length,
    };

    // Get occupied slots count
    try {
      const occupiedSlotsResult = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM parking_slots WHERE status = 'occupied'`,
          (err, row) => {
            if (err) {
              console.error("Error counting occupied slots:", err);
              resolve({ count: 0 });
            } else {
              resolve(row || { count: 0 });
            }
          }
        );
      });
      stats.occupied_slots = occupiedSlotsResult.count;
    } catch (countError) {
      console.error("Occupied slots count error:", countError);
      stats.occupied_slots = 0;
    }

    res.render("cashier/dashboard", {
      title: "Cashier Dashboard",
      currentShift,
      recentTickets,
      availableSlots,
      pendingPayments,
      stats,
      moment: moment,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    // Provide default values if there's an error
    res.render("cashier/dashboard", {
      title: "Cashier Dashboard",
      currentShift: null,
      recentTickets: [],
      availableSlots: [],
      pendingPayments: [],
      stats: {
        vacant_slots: 0,
        occupied_slots: 0,
        today_tickets: 0,
        today_pending: 0,
      },
      moment: moment,
      user: req.session.user,
    });
  }
});

// Check-in page
router.get("/check-in", async (req, res) => {
  try {
    const db = getDatabase();

    const availableSlots = await new Promise((resolve, reject) => {
      db.all(
        `
        SELECT * FROM parking_slots 
        WHERE status = 'vacant' AND slot_type != 'out_of_service'
        ORDER BY slot_number
      `,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.render("cashier/check-in", {
      title: "Vehicle Check-In",
      availableSlots,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Check-in page error:", error);
    res.status(500).render("error", {
      title: "Error",
      error: {},
      message: "Failed to load check-in page",
    });
  }
});

// Check-in process
router.post("/check-in", async (req, res) => {
  const {
    slot_id,
    license_plate,
    make,
    model,
    color,
    year,
    owner_name,
    owner_phone,
    owner_email,
    driver_name,
    driver_phone,
    driver_email,
    id_number,
    license_number,
    address,
  } = req.body;

  if (!slot_id || !license_plate || !driver_name) {
    return res.redirect("/cashier/check-in?error=Required fields are missing");
  }

  try {
    const db = getDatabase();

    // Start transaction
    db.serialize(() => {
      // Check if slot is still available
      db.get(
        "SELECT status FROM parking_slots WHERE id = ?",
        [slot_id],
        (err, slot) => {
          if (err || !slot || slot.status !== "vacant") {
            return res.redirect(
              "/cashier/check-in?error=Selected slot is no longer available"
            );
          }

          // Insert or update vehicle
          db.run(
            `
          INSERT OR REPLACE INTO vehicles (license_plate, make, model, color, year, owner_name, owner_phone, owner_email)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
            [
              license_plate,
              make,
              model,
              color,
              year,
              owner_name,
              owner_phone,
              owner_email,
            ],
            function (err) {
              if (err) {
                console.error("Error inserting vehicle:", err);
                return res.redirect(
                  "/cashier/check-in?error=Failed to register vehicle"
                );
              }

              const vehicleId = this.lastID;

              // Insert or update driver
              db.run(
                `
            INSERT OR REPLACE INTO drivers (full_name, phone, email, id_number, license_number, address)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
                [
                  driver_name,
                  driver_phone,
                  driver_email,
                  id_number,
                  license_number,
                  address,
                ],
                function (err) {
                  if (err) {
                    console.error("Error inserting driver:", err);
                    return res.redirect(
                      "/cashier/check-in?error=Failed to register driver"
                    );
                  }

                  const driverId = this.lastID;

                  // Generate ticket number
                  const ticketNumber = `TKT${Date.now()}`;

                  // Create parking ticket
                  db.run(
                    `
              INSERT INTO parking_tickets (ticket_number, slot_id, vehicle_id, driver_id, cashier_id, check_in_time)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `,
                    [
                      ticketNumber,
                      slot_id,
                      vehicleId,
                      driverId,
                      req.session.user.id,
                    ],
                    function (err) {
                      if (err) {
                        console.error("Error creating ticket:", err);
                        return res.redirect(
                          "/cashier/check-in?error=Failed to create parking ticket"
                        );
                      }

                      const ticketId = this.lastID;

                      // Update slot status
                      db.run(
                        'UPDATE parking_slots SET status = "occupied" WHERE id = ?',
                        [slot_id],
                        async function (err) {
                          if (err) {
                            console.error("Error updating slot status:", err);
                          }

                          // Log the check-in
                          await logAudit(
                            req.session.user.id,
                            "CHECK_IN",
                            "parking_tickets",
                            ticketId,
                            null,
                            JSON.stringify(req.body),
                            req.ip,
                            req.get("User-Agent")
                          );

                          res.redirect(
                            `/cashier/ticket/${ticketId}?success=Vehicle checked in successfully`
                          );
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  } catch (error) {
    console.error("Check-in error:", error);
    res.redirect("/cashier/check-in?error=System error occurred");
  }
});

// View ticket details
router.get("/ticket/:id", async (req, res) => {
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
          v.year,
          v.owner_name,
          v.owner_phone,
          d.full_name as driver_name,
          d.phone as driver_phone,
          d.id_number,
          d.license_number
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
      return res.status(404).render("error", {
        title: "Ticket Not Found",
        error: {},
        message: "The requested parking ticket does not exist.",
      });
    }

    // Calculate duration and estimated cost
    const checkInTime = moment(ticket.check_in_time);
    const now = moment();
    const durationHours = now.diff(checkInTime, "hours", true);
    const estimatedCost = Math.ceil(durationHours) * ticket.hourly_rate;

    res.render("cashier/ticket", {
      title: "Parking Ticket",
      ticket,
      durationHours: durationHours.toFixed(2),
      estimatedCost,
      user: req.session.user,
      success: req.query.success,
    });
  } catch (error) {
    console.error("Ticket view error:", error);
    res.status(500).render("error", {
      title: "Error",
      error: {},
      message: "Failed to load ticket details",
    });
  }
});

// Check-out page - list all pending tickets
router.get("/check-out", async (req, res) => {
  try {
    const db = getDatabase();
    const searchQuery = req.query.search;

    let pendingTickets = [];
    let searchResults = [];

    if (searchQuery && searchQuery.trim()) {
      // Search for tickets by ticket number or license plate
      console.log(`[DEBUG] Searching for: "${searchQuery}"`);

      searchResults = await new Promise((resolve, reject) => {
        db.all(
          `
          SELECT 
            pt.*,
            ps.slot_number,
            ps.slot_name,
            ps.hourly_rate,
            v.license_plate,
            v.make,
            v.model,
            d.full_name as driver_name,
            d.phone as driver_phone
          FROM parking_tickets pt
          JOIN parking_slots ps ON pt.slot_id = ps.id
          JOIN vehicles v ON pt.vehicle_id = v.id
          JOIN drivers d ON pt.driver_id = d.id
          WHERE (pt.ticket_number LIKE ? OR v.license_plate LIKE ?)
          ORDER BY pt.check_in_time DESC
          LIMIT 10
        `,
          [`%${searchQuery}%`, `%${searchQuery}%`],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      console.log(`[DEBUG] Search results found: ${searchResults.length}`);
    }

    // Get pending tickets for this cashier (only if no search or search returned no results)
    if (!searchQuery || searchResults.length === 0) {
      pendingTickets = await new Promise((resolve, reject) => {
        db.all(
          `
          SELECT 
            pt.*,
            ps.slot_number,
            ps.slot_name,
            ps.hourly_rate,
            v.license_plate,
            v.make,
            v.model,
            d.full_name as driver_name,
            d.phone as driver_phone
          FROM parking_tickets pt
          JOIN parking_slots ps ON pt.slot_id = ps.id
          JOIN vehicles v ON pt.vehicle_id = v.id
          JOIN drivers d ON pt.driver_id = d.id
          WHERE pt.payment_status = 'pending'
          ORDER BY pt.check_in_time ASC
        `,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });
    }

    res.render("cashier/check-out", {
      title: "Vehicle Check-Out",
      pendingTickets,
      searchResults,
      searchQuery,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Check-out page error:", error);
    res.status(500).render("error", {
      title: "Error",
      error: {},
      message: "Failed to load check-out page",
    });
  }
});

// Check-out page - individual ticket
router.get("/check-out/:id", async (req, res) => {
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
          d.full_name as driver_name
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
      return res.status(404).render("error", {
        title: "Ticket Not Found",
        error: {},
        message: "The requested parking ticket does not exist.",
      });
    }

    if (ticket.payment_status === "paid") {
      return res.redirect("/cashier/dashboard?error=Ticket is already paid");
    }

    // Calculate duration and cost
    const checkInTime = moment(ticket.check_in_time);
    const now = moment();
    const durationHours = now.diff(checkInTime, "hours", true);
    const totalCost = Math.ceil(durationHours) * ticket.hourly_rate;

    res.render("cashier/check-out-ticket", {
      title: "Vehicle Check-Out",
      ticket,
      durationHours: durationHours.toFixed(2),
      totalCost,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Check-out page error:", error);
    res.status(500).render("error", {
      title: "Error",
      error: {},
      message: "Failed to load check-out page",
    });
  }
});

// Check-out process
router.post("/check-out/:id", async (req, res) => {
  const { payment_method, reference_number, notes } = req.body;
  const ticketId = req.params.id;

  if (!payment_method) {
    return res.redirect(
      `/cashier/check-out/${ticketId}?error=Payment method is required`
    );
  }

  try {
    const db = getDatabase();

    // Get ticket details
    const ticket = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT pt.*, ps.hourly_rate, ps.id as slot_id
        FROM parking_tickets pt
        JOIN parking_slots ps ON pt.slot_id = ps.id
        WHERE pt.id = ?
      `,
        [ticketId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!ticket) {
      return res.redirect("/cashier/dashboard?error=Ticket not found");
    }

    // Calculate final cost
    const checkInTime = moment(ticket.check_in_time);
    const now = moment();
    const durationHours = now.diff(checkInTime, "hours", true);
    const totalCost = Math.ceil(durationHours) * ticket.hourly_rate;

    // Start transaction with better error handling
    db.serialize(() => {
      let transactionFailed = false;
      let errorMessage = "";

      // Update ticket with check-out time and payment status
      db.run(
        `
        UPDATE parking_tickets 
        SET check_out_time = CURRENT_TIMESTAMP, duration_hours = ?, total_amount = ?, payment_status = 'paid'
        WHERE id = ?
      `,
        [durationHours, totalCost, ticketId],
        function (err) {
          if (err) {
            console.error("Error updating ticket:", err);
            transactionFailed = true;
            errorMessage = "Failed to update ticket";
            return;
          }

          console.log(`[DEBUG] Ticket ${ticketId} updated successfully`);

          // Create payment record
          const receiptNumber = `RCP${Date.now()}`;
          console.log(
            `[DEBUG] Creating payment record for ticket ${ticketId}:`,
            {
              amount: totalCost,
              payment_method,
              reference_number,
              cashier_id: req.session.user.id,
              receipt_number: receiptNumber,
              notes,
            }
          );

          db.run(
            `
          INSERT INTO payments (ticket_id, amount, payment_method, reference_number, cashier_id, receipt_number, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
            [
              ticketId,
              totalCost,
              payment_method,
              reference_number,
              req.session.user.id,
              receiptNumber,
              notes,
            ],
            function (err) {
              if (err) {
                console.error("Error creating payment:", err);
                return res.redirect(
                  `/cashier/check-out/${ticketId}?error=Failed to create payment record`
                );
              }

              console.log(
                `[DEBUG] Payment record created successfully with ID: ${this.lastID}`
              );

              // Update slot status to vacant
              db.run(
                'UPDATE parking_slots SET status = "vacant" WHERE id = ?',
                [ticket.slot_id],
                async function (err) {
                  if (err) {
                    console.error("Error updating slot status:", err);
                    // Don't fail the transaction for slot status update
                  }

                  // Check if transaction failed at any point
                  if (transactionFailed) {
                    console.error(
                      `[DEBUG] Transaction failed: ${errorMessage}`
                    );
                    return res.redirect(
                      `/cashier/check-out/${ticketId}?error=${errorMessage}`
                    );
                  }

                  // Log the check-out
                  await logAudit(
                    req.session.user.id,
                    "CHECK_OUT",
                    "parking_tickets",
                    ticketId,
                    null,
                    JSON.stringify(req.body),
                    req.ip,
                    req.get("User-Agent")
                  );

                  res.redirect(
                    `/cashier/receipt/${ticketId}?success=Vehicle checked out successfully`
                  );
                }
              );
            }
          );
        }
      );
    });
  } catch (error) {
    console.error("Check-out error:", error);
    res.redirect(`/cashier/check-out/${ticketId}?error=System error occurred`);
  }
});

// View receipt
router.get("/receipt/:id", async (req, res) => {
  try {
    const db = getDatabase();
    const ticketId = req.params.id;

    console.log(`[DEBUG] Receipt requested for ticket ID: ${ticketId}`);

    // First check if the ticket exists and has payment status
    const ticket = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id, payment_status, ticket_number, total_amount, check_in_time, check_out_time FROM parking_tickets WHERE id = ?`,
        [ticketId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    console.log(`[DEBUG] Ticket found:`, ticket);

    if (!ticket) {
      console.log(`[DEBUG] Ticket not found for ID: ${ticketId}`);
      return res.status(404).render("error", {
        title: "Ticket Not Found",
        error: {},
        message: "The requested parking ticket does not exist.",
      });
    }

    if (ticket.payment_status !== "paid") {
      console.log(
        `[DEBUG] Ticket ${ticket.ticket_number} payment status: ${ticket.payment_status}`
      );
      return res.status(400).render("error", {
        title: "Payment Required",
        error: {},
        message:
          "This ticket has not been paid yet. Please process payment first.",
      });
    }

    // Check if payment record exists
    const paymentCheck = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id, amount, payment_method FROM payments WHERE ticket_id = ?`,
        [ticketId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    console.log(`[DEBUG] Payment record found:`, paymentCheck);

    if (!paymentCheck) {
      console.log(`[DEBUG] No payment record found for ticket ${ticketId}`);

      // Try to create a missing payment record (recovery mechanism)
      try {
        const recoveryReceiptNumber = `RCP${Date.now()}`;
        console.log(
          `[DEBUG] Attempting to create recovery payment record for ticket ${ticketId}`
        );

        // Calculate the correct amount if total_amount is 0
        let paymentAmount = ticket.total_amount;
        if (!paymentAmount || paymentAmount === 0) {
          console.log(
            `[DEBUG] Total amount is 0, calculating from check-in/out times`
          );

          // Get slot hourly rate and calculate amount
          const slotInfo = await new Promise((resolve, reject) => {
            db.get(
              `SELECT ps.hourly_rate FROM parking_slots ps 
               JOIN parking_tickets pt ON ps.id = pt.slot_id 
               WHERE pt.id = ?`,
              [ticketId],
              (err, row) => {
                if (err) reject(err);
                else resolve(row);
              }
            );
          });

          if (slotInfo && ticket.check_in_time && ticket.check_out_time) {
            const checkInTime = moment(ticket.check_in_time);
            const checkOutTime = moment(ticket.check_out_time);
            const durationHours = checkOutTime.diff(checkInTime, "hours", true);
            paymentAmount = Math.ceil(durationHours) * slotInfo.hourly_rate;
            console.log(
              `[DEBUG] Calculated amount: $${paymentAmount} (${durationHours.toFixed(
                2
              )} hours × $${slotInfo.hourly_rate})`
            );
          } else {
            paymentAmount = 5; // Default amount if calculation fails
            console.log(`[DEBUG] Using default amount: $${paymentAmount}`);
          }
        }

        await new Promise((resolve, reject) => {
          db.run(
            `INSERT INTO payments (ticket_id, amount, payment_method, reference_number, cashier_id, receipt_number, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              ticketId,
              paymentAmount,
              "cash", // Default payment method
              "RECOVERY",
              req.session.user.id,
              recoveryReceiptNumber,
              "Payment record recovered automatically",
            ],
            function (err) {
              if (err) {
                console.error(`[DEBUG] Recovery payment creation failed:`, err);
                reject(err);
              } else {
                console.log(
                  `[DEBUG] Recovery payment record created with ID: ${this.lastID}`
                );
                resolve();
              }
            }
          );
        });

        console.log(
          `[DEBUG] Recovery payment record created successfully with amount: $${paymentAmount}`
        );
      } catch (recoveryError) {
        console.error(`[DEBUG] Recovery failed:`, recoveryError);
        return res.status(404).render("error", {
          title: "Payment Record Missing",
          error: {},
          message:
            "Payment record not found and could not be recovered. Please contact system administrator.",
        });
      }
    }

    const receipt = await new Promise((resolve, reject) => {
      db.get(
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
          p.amount,
          p.payment_method,
          p.receipt_number,
          p.payment_date,
          u.full_name as cashier_name
        FROM parking_tickets pt
        JOIN parking_slots ps ON pt.slot_id = ps.id
        JOIN vehicles v ON pt.vehicle_id = v.id
        JOIN drivers d ON pt.driver_id = d.id
        JOIN payments p ON pt.id = p.ticket_id
        JOIN users u ON pt.cashier_id = u.id
        WHERE pt.id = ?
      `,
        [ticketId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    console.log(`[DEBUG] Receipt data:`, receipt);

    if (!receipt) {
      console.log(`[DEBUG] Receipt join query failed for ticket ${ticketId}`);
      return res.status(404).render("error", {
        title: "Receipt Not Found",
        error: {},
        message:
          "The requested receipt does not exist. Payment record may be missing.",
      });
    }

    res.render("cashier/receipt", {
      title: "Payment Receipt",
      receipt,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Receipt view error:", error);
    res.status(500).render("error", {
      title: "Error",
      error: {},
      message: "Failed to load receipt",
    });
  }
});

// Shift management
router.get("/shift/open", async (req, res) => {
  try {
    const db = getDatabase();

    // Check if shift is already open
    const currentShift = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT * FROM shifts 
        WHERE cashier_id = ? AND shift_date = DATE('now') AND status = 'open'
      `,
        [req.session.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    res.render("cashier/shift-open", {
      title: "Open Shift",
      currentShift: currentShift,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Shift open page error:", error);
    res.status(500).render("error", {
      title: "Error",
      error: {},
      message: "Failed to load shift open page",
    });
  }
});

// Open shift process
router.post("/shift/open", async (req, res) => {
  const { opening_amount, notes } = req.body;

  try {
    const db = getDatabase();

    db.run(
      `
      INSERT INTO shifts (cashier_id, shift_date, open_time, opening_amount, notes)
      VALUES (?, DATE('now'), CURRENT_TIMESTAMP, ?, ?)
    `,
      [req.session.user.id, opening_amount || 0, notes],
      async function (err) {
        if (err) {
          console.error("Error opening shift:", err);
          return res.redirect("/cashier/shift/open?error=Failed to open shift");
        }

        await logAudit(
          req.session.user.id,
          "OPEN_SHIFT",
          "shifts",
          this.lastID,
          null,
          JSON.stringify(req.body),
          req.ip,
          req.get("User-Agent")
        );
        res.redirect("/cashier/dashboard?success=Shift opened successfully");
      }
    );
  } catch (error) {
    console.error("Open shift error:", error);
    res.redirect("/cashier/shift/open?error=System error occurred");
  }
});

// Close shift page
router.get("/shift/close", async (req, res) => {
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
      return res.redirect("/cashier/dashboard?error=No open shift found");
    }

    // Calculate total collected
    const totalCollected = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT COALESCE(SUM(p.amount), 0) as total
        FROM payments p
        JOIN parking_tickets pt ON p.ticket_id = pt.id
        WHERE pt.cashier_id = ? AND DATE(p.payment_date) = DATE('now')
      `,
        [req.session.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    // Get shift summary data
    const shiftSummary = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT 
          COALESCE(SUM(p.amount), 0) as total_collected,
          COUNT(DISTINCT pt.id) as total_tickets,
          COUNT(DISTINCT CASE WHEN pt.payment_status = 'pending' THEN pt.id END) as pending_payments
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

    res.render("cashier/shift-close", {
      title: "Close Shift",
      currentShift: currentShift,
      shiftSummary: shiftSummary,
      user: req.session.user,
    });
  } catch (error) {
    console.error("Shift close page error:", error);
    res.status(500).render("error", {
      title: "Error",
      error: {},
      message: "Failed to load shift close page",
    });
  }
});

// Close shift process
router.post("/shift/close", async (req, res) => {
  const { closing_amount, notes } = req.body;

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
      return res.redirect("/cashier/dashboard?error=No open shift found");
    }

    // Calculate total collected and variance
    const totalCollected = await new Promise((resolve, reject) => {
      db.get(
        `
        SELECT COALESCE(SUM(p.amount), 0) as total
        FROM payments p
        JOIN parking_tickets pt ON p.ticket_id = pt.id
        WHERE pt.cashier_id = ? AND DATE(p.payment_date) = DATE('now')
      `,
        [req.session.user.id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    const variance = (closing_amount || 0) - totalCollected.total;

    // Close the shift
    db.run(
      `
      UPDATE shifts 
      SET close_time = CURRENT_TIMESTAMP, closing_amount = ?, total_collected = ?, variance = ?, status = 'closed', notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      [
        closing_amount || 0,
        totalCollected.total,
        variance,
        notes,
        currentShift.id,
      ],
      async function (err) {
        if (err) {
          console.error("Error closing shift:", err);
          return res.redirect(
            "/cashier/shift/close?error=Failed to close shift"
          );
        }

        await logAudit(
          req.session.user.id,
          "CLOSE_SHIFT",
          "shifts",
          currentShift.id,
          null,
          JSON.stringify(req.body),
          req.ip,
          req.get("User-Agent")
        );
        res.redirect("/cashier/dashboard?success=Shift closed successfully");
      }
    );
  } catch (error) {
    console.error("Close shift error:", error);
    res.redirect("/cashier/shift/close?error=System error occurred");
  }
});

module.exports = router;
