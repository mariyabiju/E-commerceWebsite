const express = require("express");
const passport = require("passport");
const authController = require("../controllers/authController"); // Fixed and consistent import
const paymentController = require("../controllers/paymentController"); 

const authMiddleware = require('../middleware/authMiddleware');
const { sendOtp, verifyOtp } = require('../controllers/authController');
const multer = require("multer");
const path = require("path");

// Multer Storage Configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Ensure 'uploads/' folder exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });



const router = express.Router();

function checkAlreadyLoggedIn(req, res, next) {
  if (req.session.userId) {
    return res.redirect("/product/home"); // Redirect to home if already logged in
  }
  next();
}

// Login page
router.get("/login",checkAlreadyLoggedIn, (req, res) => res.render("login")); // Render login page

//register
router.get('/register', checkAlreadyLoggedIn,(req, res) => {
  res.render('login'); 
});



// Google OAuth
router.get("/auth/google", (req, res) => {
  res.send(`
    <script>
      history.replaceState(null, null, "/"); 
      window.location.href = "/auth/google/redirect";
    </script>
  `);
});

// Google OAuth Redirect (Triggers Google Login)
router.get(
  "/auth/google/redirect",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Handle Google OAuth Callback
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login?error=unregistered" }),
  (req, res) => {
    req.session.userId = req.user._id;
    req.session.fname = req.user.fname;
    req.session.successMsg = "Login successful! Welcome back!";

    res.send(`
      <script>
        history.replaceState(null, null, "/product/home"); 
        window.location.replace("/product/home");
      </script>
    `);
  }
);

// Add this new route to prevent back navigation
router.get("/prevent-back", (req, res) => {
  res.send(`
    <script>
      history.replaceState(null, null, "/product/home"); 
      window.location.replace("/product/home");
    </script>
  `);
});


// Routes
router.post('/send-otp', sendOtp); // Send OTP to phone
router.post('/verify-otp', verifyOtp); // Verify the OTP

router.get("/otp-verification",checkAlreadyLoggedIn, (req, res) => {
  res.render("otp-verification"); 
});
router.get("/otp-verificationEmail", (req, res) => {
  res.render("otp-verification"); 
});


router.post("/resend-otp", authController.resendOTP);


router.post("/register", authController.registerUser);
router.post("/otp-verification", authController.verifyOTP);
router.post("/login", authController.login);


router.post("/forgot_password", authController.forgotPassword);
router.post("/reset_password", authController.resetPassword);
router.get("/forgot_password",checkAlreadyLoggedIn, (req, res) => {
  res.render("forgot_password"); 
});


router.get('/profile', authController.getEditProfile);
router.post("/update-profile" , authController.profileEdit);
router.post("/check-email-change",authController.profileEmailEdit);
router.post("/otp-verificationEmail", authController.verifyOTP);
router.post("/updateProfilePic/:id", upload.single("profilePic"), authController.updateProfilePic);
router.delete("/remove-profile-pic/:id", authController.removeProfilePic);


//wallet 

router.get("/wallet", paymentController.getWalletPage)
router.post("/wallet/create-order", paymentController.createOrder);
router.post("/wallet/payment-success", paymentController.paymentSuccess);

router.get("/dashboard", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login"); // Prevent unauthorized access
  }
  res.send(`Welcome ${req.user.username}`); // Show logged-in user's name
});


module.exports = router;
