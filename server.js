const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const moment = require("moment");

// Import routes
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const cashierRoutes = require("./routes/cashier");
const apiRoutes = require("./routes/api");

// Import database initialization
const { initDatabase } = require("./database/init");

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://code.jquery.com",
          "https://cdnjs.cloudflare.com",
          "https://unpkg.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// CORS
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Session configuration - MOVED BEFORE ROUTES
app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: "./database",
    }),
    secret: "digital-parking-secret-key-2024",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Import EJS helpers
const ejsHelpers = require("./views/helpers/ejs-helpers");

// Global middleware for user authentication - MOVED BEFORE ROUTES
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.isAuthenticated = !!req.session.user;
  res.locals.isAdmin = req.session.user && req.session.user.role === "admin";
  res.locals.isCashier =
    req.session.user && req.session.user.role === "cashier";
  res.locals.moment = moment;

  // Add EJS helpers to all templates
  Object.assign(res.locals, ejsHelpers);

  next();
});

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes - NOW AFTER SESSION MIDDLEWARE
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/cashier", cashierRoutes);
app.use("/api", apiRoutes);

// Home route - redirect to login if not authenticated
app.get("/", (req, res) => {
  // Always redirect to login for now to ensure proper authentication flow
  res.redirect("/auth/login");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", {
    title: "Error",
    error: process.env.NODE_ENV === "development" ? err : {},
    message: "Something went wrong!",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render("error", {
    title: "Page Not Found",
    error: {},
    message: "The page you are looking for does not exist.",
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    console.log("Database initialized successfully");

    app.listen(PORT, () => {
      console.log(
        `🚗 Digital Parking Management System running on port ${PORT}`
      );
      console.log(
        `🌐 Open your browser and navigate to: http://localhost:${PORT}`
      );
      console.log(`📱 System is responsive and works on all devices`);
    });
  } catch (error) {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
