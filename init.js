const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");

const dbPath = path.join(__dirname, "parking_system.db");

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to SQLite database");
  }
});

// Initialize database tables
async function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Enable foreign keys
      db.run("PRAGMA foreign_keys = ON");

      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role TEXT CHECK(role IN ('admin', 'cashier')) NOT NULL,
        email VARCHAR(100),
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Parking slots table
      db.run(`CREATE TABLE IF NOT EXISTS parking_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slot_number VARCHAR(10) UNIQUE NOT NULL,
        slot_name VARCHAR(50),
        status TEXT CHECK(status IN ('vacant', 'occupied', 'reserved', 'out_of_service')) DEFAULT 'vacant',
        slot_type TEXT CHECK(slot_type IN ('standard', 'disabled', 'vip')) DEFAULT 'standard',
        hourly_rate DECIMAL(10,2) DEFAULT 5.00,
        daily_rate DECIMAL(10,2) DEFAULT 50.00,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Vehicles table
      db.run(`CREATE TABLE IF NOT EXISTS vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        license_plate VARCHAR(20) UNIQUE NOT NULL,
        make VARCHAR(50),
        model VARCHAR(50),
        color VARCHAR(30),
        year INTEGER,
        owner_name VARCHAR(100),
        owner_phone VARCHAR(20),
        owner_email VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Drivers table
      db.run(`CREATE TABLE IF NOT EXISTS drivers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name VARCHAR(100) NOT NULL,
        phone VARCHAR(20),
        email VARCHAR(100),
        id_number VARCHAR(50),
        license_number VARCHAR(50),
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Parking tickets table
      db.run(`CREATE TABLE IF NOT EXISTS parking_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_number VARCHAR(20) UNIQUE NOT NULL,
        slot_id INTEGER NOT NULL,
        vehicle_id INTEGER NOT NULL,
        driver_id INTEGER NOT NULL,
        cashier_id INTEGER NOT NULL,
        check_in_time DATETIME NOT NULL,
        check_out_time DATETIME,
        duration_hours DECIMAL(5,2),
        total_amount DECIMAL(10,2),
        payment_status TEXT CHECK(payment_status IN ('pending', 'paid', 'cancelled')) DEFAULT 'pending',
        payment_method TEXT CHECK(payment_method IN ('cash', 'mfs', 'card')) DEFAULT 'cash',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (slot_id) REFERENCES parking_slots (id),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles (id),
        FOREIGN KEY (driver_id) REFERENCES drivers (id),
        FOREIGN KEY (cashier_id) REFERENCES users (id)
      )`);

      // Payments table
      db.run(`CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method TEXT CHECK(payment_method IN ('cash', 'mfs', 'card')) NOT NULL,
        reference_number VARCHAR(100),
        cashier_id INTEGER NOT NULL,
        payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        receipt_number VARCHAR(50) UNIQUE,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES parking_tickets (id),
        FOREIGN KEY (cashier_id) REFERENCES users (id)
      )`);

      // Shifts table
      db.run(`CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cashier_id INTEGER NOT NULL,
        shift_date DATE NOT NULL,
        open_time DATETIME NOT NULL,
        close_time DATETIME,
        opening_amount DECIMAL(10,2) DEFAULT 0.00,
        closing_amount DECIMAL(10,2) DEFAULT 0.00,
        total_collected DECIMAL(10,2) DEFAULT 0.00,
        variance DECIMAL(10,2) DEFAULT 0.00,
        status TEXT CHECK(status IN ('open', 'closed')) DEFAULT 'open',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cashier_id) REFERENCES users (id)
      )`);

      // Audit logs table
      db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action VARCHAR(100) NOT NULL,
        table_name VARCHAR(50),
        record_id INTEGER,
        old_values TEXT,
        new_values TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`);

      // Sessions table for express-session SQLite store
      db.run(`CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR(255) PRIMARY KEY,
        sess TEXT NOT NULL,
        expired DATETIME NOT NULL
      )`);

      // Insert default admin user
      db.get(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin'",
        (err, row) => {
          if (err) {
            console.error("Error checking admin users:", err);
            reject(err);
            return;
          }

          if (row.count === 0) {
            const defaultPassword = "admin123";
            bcrypt.hash(defaultPassword, 10, (err, hash) => {
              if (err) {
                console.error("Error hashing password:", err);
                reject(err);
                return;
              }

              db.run(
                `INSERT INTO users (username, password, full_name, role, email) 
                    VALUES (?, ?, ?, ?, ?)`,
                [
                  "admin",
                  hash,
                  "System Administrator",
                  "admin",
                  "admin@parking.com",
                ],
                function (err) {
                  if (err) {
                    console.error("Error creating default admin:", err);
                    reject(err);
                  } else {
                    console.log(
                      "Default admin user created with username: admin, password: admin123"
                    );
                  }
                }
              );
            });
          }
        }
      );

      // Insert default cashier user
      db.get(
        "SELECT COUNT(*) as count FROM users WHERE role = 'cashier'",
        (err, row) => {
          if (err) {
            console.error("Error checking cashier users:", err);
            reject(err);
            return;
          }

          if (row.count === 0) {
            const defaultPassword = "cashier123";
            bcrypt.hash(defaultPassword, 10, (err, hash) => {
              if (err) {
                console.error("Error hashing password:", err);
                reject(err);
                return;
              }

              db.run(
                `INSERT INTO users (username, password, full_name, role, email) 
                    VALUES (?, ?, ?, ?, ?)`,
                [
                  "cashier",
                  hash,
                  "Test Cashier",
                  "cashier",
                  "cashier@parking.com",
                ],
                function (err) {
                  if (err) {
                    console.error("Error creating default cashier:", err);
                    reject(err);
                  } else {
                    console.log(
                      "Default cashier user created with username: cashier, password: cashier123"
                    );
                  }
                }
              );
            });
          }
        }
      );

      // Insert default parking slots
      db.get("SELECT COUNT(*) as count FROM parking_slots", (err, row) => {
        if (err) {
          console.error("Error checking parking slots:", err);
          reject(err);
          return;
        }

        if (row.count === 0) {
          // Create slots array with proper SQL syntax
          const slots = [];
          for (let i = 1; i <= 20; i++) {
            slots.push([`A${i.toString().padStart(2, "0")}`, `Slot A${i.toString().padStart(2, "0")}`, 'vacant', 'standard', 5.00, 50.00]);
          }
          for (let i = 1; i <= 15; i++) {
            slots.push([`B${i.toString().padStart(2, "0")}`, `Slot B${i.toString().padStart(2, "0")}`, 'vacant', 'standard', 5.00, 50.00]);
          }
          // Add some disabled and VIP slots
          slots.push(['D01', 'Disabled Slot 1', 'vacant', 'disabled', 3.00, 30.00]);
          slots.push(['V01', 'VIP Slot 1', 'vacant', 'vip', 8.00, 80.00]);
          slots.push(['V02', 'VIP Slot 2', 'vacant', 'vip', 8.00, 80.00]);

          // Insert slots one by one to avoid syntax issues
          let insertedCount = 0;
          const totalSlots = slots.length;
          
          slots.forEach((slot, index) => {
            db.run(
              `INSERT INTO parking_slots (slot_number, slot_name, status, slot_type, hourly_rate, daily_rate) 
               VALUES (?, ?, ?, ?, ?, ?)`,
              slot,
              function (err) {
                if (err) {
                  console.error("Error creating parking slot:", err);
                  reject(err);
                  return;
                }
                insertedCount++;
                if (insertedCount === totalSlots) {
                  console.log("Default parking slots created successfully");
                }
              }
            );
          });
        }
      });

      // Create indexes for better performance
      db.run(
        "CREATE INDEX IF NOT EXISTS idx_tickets_slot_id ON parking_tickets(slot_id)"
      );
      db.run(
        "CREATE INDEX IF NOT EXISTS idx_tickets_vehicle_id ON parking_tickets(vehicle_id)"
      );
      db.run(
        "CREATE INDEX IF NOT EXISTS idx_tickets_check_in_time ON parking_tickets(check_in_time)"
      );
      db.run(
        "CREATE INDEX IF NOT EXISTS idx_payments_ticket_id ON payments(ticket_id)"
      );
      db.run(
        "CREATE INDEX IF NOT EXISTS idx_shifts_cashier_date ON shifts(cashier_id, shift_date)"
      );
      db.run(
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action ON audit_logs(user_id, action)"
      );
      db.run("CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired)");

      console.log("Database tables and indexes created successfully");
      resolve();
    });
  });
}

// Get database instance
function getDatabase() {
  return db;
}

// Close database connection
function closeDatabase() {
  db.close((err) => {
    if (err) {
      console.error("Error closing database:", err.message);
    } else {
      console.log("Database connection closed");
    }
  });
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase,
};
