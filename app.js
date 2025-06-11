const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const passport = require("passport");
const cors = require("cors");
const flash = require("connect-flash");
const path = require("path");

// Load environment variables
require("./config/dotenvConfig");

// Initialize Express App
const app = express();

// Connect to MongoDB
mongoose
  .connect(process.env.DB_CONNECTION_STRING, { 
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Import Models
const User = require("./models/User");
const Category = require("./models/Category");

// Passport Configuration
require("./config/passport")(passport);

// Middleware: Static Files
app.use(express.static(path.join(__dirname, "public")));

app.use('/uploads', express.static('uploads'));

// Middleware: Session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URL }),
    cookie: { maxAge: Number(process.env.SESSION_LIFETIME) }, // Convert to number
  })
);

// Middleware: CORS & Parsing
app.use(cors());
app.use(express.json()); // Parse JSON requests
app.use(express.urlencoded({ extended: true })); // Parse form data

// Middleware: Flash Messages
app.use(flash());
app.use((req, res, next) => {
  res.locals.successMessage = req.flash("success");
  res.locals.errorMessage = req.flash("error");
  res.locals.messages = req.flash();
  next();
});

// Middleware: Prevent Cache Issues
app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    next();
});



// Middleware: Fetch Categories for Views
app.use(async (req, res, next) => {
  try {
    res.locals.categories = await Category.find();
    next();
  } catch (error) {
    console.error("Error fetching categories:", error);
    next();
  }
});

// Middleware: Passport Authentication
app.use(passport.initialize());
app.use(passport.session());

// Middleware: Session Management
const sessionMiddleware = require("./middleware/session");
app.use(sessionMiddleware);
const authController = require("./controllers/authController");



// Middleware: User Session Check
const checkUserSession = async (req, res, next) => {
  if (!req.session.userId) return next(); // No session, move to next

  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy((err) => {
        if (err) console.error("Session Destroy Error:", err);
        res.clearCookie("connect.sid", { path: "/" });
        return res.redirect("/login");
      });
    } else {
      next();
    }
  } catch (error) {
    console.error("Database Error:", error);
    next();
  }
};

app.use(checkUserSession);
app.use(authController.checkBlockedStatus)

// Logout Route
app.post("/admin/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.json({ success: false, message: "Logout failed" });
        }
        res.json({ success: true, redirect: "/admin/login" });
    });
});
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
      if (err) {
          return res.json({ success: false, message: "Logout failed" });
      }
      // Clear cache to prevent back navigation restoring session
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.json({ success: true, redirect: "/product/home" });
  });
});
app.get("/get-user-email", async (req, res) => {
  try {
      const user = await User.findById(req.session.userId); // Fetch user from DB
      res.json({ emailId: user.emailId }); // Send stored email
  } catch (error) {
      res.status(500).json({ message: "Error fetching email" });
  }
});


// View Engine
app.set("view engine", "ejs");

// Routes
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
const productRoutes = require("./routes/productRoutes");

app.use("/", userRoutes);
app.use("/admin", adminRoutes);
app.use("/product", productRoutes);


app.listen(3000, '0.0.0.0', () => {
  console.log("Server running on http://0.0.0.0:3000");
});

