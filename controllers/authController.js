const passport = require('passport');
require('dotenv').config();
const twilio = require('twilio');
const User = require('../models/User');
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const Address = require('../models/Address'); 
// Twilio configuration


const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);


// Redirect to Google for authentication
exports.googleLogin = passport.authenticate('google', {
  scope: ['profile', 'email'],
});

// Handle Google callback
exports.googleCallback = (req, res, next) => {
  passport.authenticate('google', (err, user, info) => { 
    if (err) return next(err);
    if (!user) return res.redirect('/login?error=Use a registered email ID to log in. If you are new, please register first!');
    
    req.logIn(user, (err) => {
      if (err) return next(err);
       // Store user data in session
       req.session.userId = user._id;
       req.session.fname = user.fname;
       req.session.lname = user.lname;
       req.session.successMsg = "Login successful! Welcome back!";


       res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");


      return res.redirect('/product/home');
    });
  })(req, res, next);
};

// Send OTP
exports.sendOtp = async (req, res) => {
  const { phone } = req.body;
  let number= "+91"+phone;
      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP

      // Send OTP via Twilio
      await client.messages.create({
          body: `Your OTP code is: ${otp}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: number,
      });

       // Save OTP and phone to session
    req.session.otp = otp;
    req.session.phone = phone;

      res.status(200).json({ message: 'OTP sent successfully.' });
};


// Verify OTP and Sign In
exports.verifyOtp = async(req, res) => {
  const { phone, otp } = req.body;

  // Check if OTP matches
  if (req.session && req.session.otp === parseInt(otp) && req.session.phone === phone) {
      // Clear OTP session after successful login
      const user = await User.findOne({ phoneNumber: phone  });
       // Store user session
       req.session.userId = user._id;
       req.session.fname = user.fname;
       req.session.lname = user.lname;
 
       // Clear OTP session after successful login
       req.session.otp = null;
       req.session.phone = null;

       // Store success message in session
       req.session.successMsg = "Login successful! Welcome back!";

      return res.json({ success: true, redirectUrl: "/product/home" });
     
    } 
    else {
      // Return error message if OTP is incorrect
      return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
  }
    
};

exports.login = async (req, res) => {
  try {
    const { emailId, password } = req.body;

    if (!emailId || !password) {
      return res.render('login', { error: "Email and password are required" });
    }

    // Find user in database
    const user = await User.findOne({ emailId });

    if (!user) {
      return res.render('login', { error: "User not found" });
    }

    if (user.isBlock) {
      return res.render('login', { error: "Your account has been blocked by the admin." });
    }

    // Compare password with stored hashed password
    const isMatch = await bcrypt.compare(password, user.hashedPassword);
    if (!isMatch) {
      return res.render('login', { error: "Incorrect password" });
    }

    // Store user ID in session
    req.session.userId = user._id; 
    req.session.fname = user.fname;
    req.session.lname = user.lname;
    req.session.successMsg = "Login successful! Welcome back!";
    
    res.send(`
      <script>
        history.replaceState(null, null, "/product/home"); // Remove login page from history
        window.location.replace("/product/home"); // Redirect to home page
      </script>
    `);

  } catch (error) {
    console.error("Server Error:", error);
    res.render('login', { error: "Server error. Please try again later." });
  }
};
exports.registerUser = async (req, res) => {
  const { fname, lname, emailId, password, phoneNumber, birthDate,source } = req.body;
  
  if (!fname || !lname || !emailId || !password || !phoneNumber || !birthDate) {
    return res.redirect(`/register?error=All fields are required!`);
  }

  try {
    const existingUser = await User.findOne({ emailId });
    if (existingUser) {
      return res.redirect(`/login?error=Email already registered!Try login with this emailId`);
    }

    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000);

     // Store OTP in session instead of DB
     req.session.otp = otpCode;
     req.session.email = emailId;
     req.session.userData = { fname, lname, emailId, password, phoneNumber, birthDate };
    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      to: emailId,
      subject: "Your OTP for Registration",
      text: `Your OTP is: ${otpCode}`,
    });

    // Redirect to OTP verification page
    return res.redirect(`/otp-verification?emailId=${encodeURIComponent(emailId)}&source=register`);

  } catch (error) {
    console.error(error);
    return res.redirect(`/login?error=Operation failed! Try registering later.`);
  }
};

exports.verifyOTP = async (req, res) => {
  const { emailId, otp, source } = req.body;

  // Debug session values
  console.log("Session OTP:", req.session.otp);
  console.log("Session Email:", req.session.email);
  console.log("Received Email:", emailId);
  console.log("Received OTP:", otp);

  if (!req.session.otp || !req.session.email) {
    return res.status(400).json({ success: false, message: "Session expired! Please try again." });
  }

  if (String(emailId).trim() !== String(req.session.email).trim() || String(otp) !== String(req.session.otp)) { 
    console.log("Email mismatch:", req.session.email, emailId);
    console.log("OTP mismatch:", req.session.otp, otp);
    return res.status(400).json({ success: false, message: "Invalid OTP!" });
  }

  try {
    if (source === "register") {
      try {
        const hashedPassword = await bcrypt.hash(req.session.userData.password, 10);
        console.log("Hashed Password:", hashedPassword);

        const newUser = new User({
          fname: req.session.userData.fname,
          lname: req.session.userData.lname,
          emailId: req.session.userData.emailId, // Ensure this is correct
          hashedPassword: hashedPassword,
          emailVerified: true,
          phoneNumber: req.session.userData.phoneNumber,
          birthDate: req.session.userData.birthDate,
        });

        await newUser.save();
        console.log("User saved successfully!");

        req.session.otp = null;
        req.session.email = null;
        req.session.userData = null;

        return res.json({ success: true, redirectUrl: "/login", message: "Registration successful! You can now log in." });

      } catch (err) {
        console.error("Error saving user:", err);
        return res.status(500).json({ success: false, message: "Database error!" });
      }
    }

    if (source === "profile") {
      const user = await User.findById(req.session.userId);
      if (!user) return res.status(404).json({ success: false, message: "User not found!" });

      user.emailId = emailId;
      await user.save();
      console.log("Profile email updated successfully!");

      // Clear session after successful verification
      req.session.otp = null;
      req.session.email = null;

      return res.json({ success: true, redirectUrl: "/profile", message: "Email updated successfully!" });
  }

  } catch (error) {
    console.error("Verification failed:", error);
    return res.status(500).json({ success: false, message: "Verification failed!" });
  }
};

exports.resendOTP = async (req, res) => {
  console.log("Request Body:", req.body); // Debugging line
  const { emailId } = req.body;  // Get email from request body

  if (!emailId) {
    return res.status(400).json({ success: false, message: "Email is required to resend OTP!" });
  }

  try {
    // Generate a new OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
    req.session.otp = newOtp;
    // Send email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Check if credentials are correct
      },
    });

    await transporter.sendMail({
      to: emailId,
      subject: "Your New OTP for Verification",
      text: `Your new OTP is: ${newOtp}`,
    });

    return res.json({ success: true, message: "New OTP sent successfully!" });

  } catch (error) {
    console.error("Error resending OTP:", error);
    return res.status(500).json({ success: false, message: "Failed to resend OTP! Try again." });
  }
};

   
// Forgot Password: Verify Email
exports.forgotPassword = async (req, res) => {
  const { emailId } = req.body;

  try {
      const user = await User.findOne({ emailId: emailId });

      if (!user) {
          return res.json({ success: false, message: "Email not registered!" });
      }

      res.json({ success: true, message: "Email verified!" });
  } catch (error) {
      res.status(500).json({ success: false, message: "Server error!" });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  const { emailId, newPassword } = req.body;
  
  try {
      const user = await User.findOne({ emailId: emailId });
      if (!user) {
          return res.json({ success: false, message: "User not found!" });
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.hashedPassword = hashedPassword;
      await user.save();

      res.json({ success: true, message: "Password updated successfully!" });
  } catch (error) {
      res.status(500).json({ success: false, message: "Server error!" });
  }
};



exports.isAuthenticated = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "You must be logged in to perform this action." });
  }
  next();
};


const moment = require('moment');

exports.getEditProfile = async (req, res) => {
  try {
      if (!req.session.userId) {
          return res.redirect('/product/home'); 
      }

      const user = await User.findById(req.session.userId);
      if (!user) {
          return res.redirect('/product/home'); 
      }

      if (user.birthDate) {
          user.birthDateFormatted = moment(user.birthDate).format("DD/MM/YYYY");
      }

      // Fetch addresses
      const addresses = await Address.find({ userId: req.session.userId });

      let homeAddress = addresses.find(addr => addr.type === 'Home') || {};
      let workAddress = addresses.find(addr => addr.type === 'Work') || {};

      req.session.addressAdded = true;

      const returnToCart = req.session.returnToCart || req.query.from === 'cart';
      if (returnToCart) req.session.returnToCart = true;



      res.render('profile', { user, homeAddress, workAddress });
  } catch (error) {
      console.error(error);
      
  }
};

exports.profileEmailEdit = async (req, res) => {
  const { emailId } = req.body;
  if (!emailId || !emailId.trim()) {
    return res.status(400).json({ success: false, message: "Email cannot be empty or only spaces." });
}

// Check if email is already in use by another user
const existingUser = await User.findOne({ emailId });
if (existingUser) {
    return res.status(400).json({ success: false, message: "This email is already in use by another user." });
}
  const user = await User.findById(req.session.userId); // Fetch user from DB

  if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
  }

  if (user.emailId !== emailId) {
      // Generate OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000);

      // Store OTP and user data in session
      req.session.otp = otpCode;
      req.session.email = emailId;

      // Send OTP via email
      const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
      });

      try {
          await transporter.sendMail({
              to: emailId,
              subject: "Your OTP for Email Verification",
              text: `Your OTP is: ${otpCode}`,
              
          });

          // Respond with success and redirect URL
          return res.json({
              success: true,
              redirectUrl: `/otp-verificationEmail?emailId=${encodeURIComponent(emailId)}&source=profile`
          });
      } catch (error) {
          console.error("Error sending email:", error);
          return res.status(500).json({ success: false, message: "Failed to send OTP. Try again." });
      }
  }

  return res.json({ success: false, message: "Email is the same, no verification needed." });
};



exports.profileEdit = async (req, res) => {
  const { fname, lname, emailId, phoneNumber, birthDate, homeAddress, workAddress } = req.body;

  try {
      // Update user details and return the updated user
      const updatedUser = await User.findByIdAndUpdate(
          req.session.userId,
          { fname, lname, emailId, phoneNumber, birthDate },
          { new: true } // Ensures updated user data is returned
      );

      if (!updatedUser) {
          return res.status(404).json({ success: false, message: "User not found." });
      }
      // Update session with new user data
      req.session.fname = updatedUser.fname;
      req.session.lname = updatedUser.lname;

      // Function to update or create address
      const updateOrCreateAddress = async (addressData, type) => {
          if (!addressData) return;

          await Address.findOneAndUpdate(
              { userId: req.session.userId, type }, // Find by userId & type
              { ...addressData, userId: req.session.userId, type }, // Update fields
              { upsert: true, new: true } // Create if not found
          );
      };

      //  Update or create home and work addresses
      await updateOrCreateAddress(homeAddress, "Home");
      await updateOrCreateAddress(workAddress, "Work");
      req.session.addressAdded = true;

      // Update related collections
      await Promise.all([
          Order.updateMany({ customerId: req.session.userId }),
          Address.updateMany({ userId: req.session.userId }),
          Cart.updateMany({ userId: req.session.userId })
      ]);

      // Save the session before responding
      req.session.save((err) => {
          if (err) {
              console.error("Session save error:", err);
              return res.status(500).json({ success: false, message: "Failed to update session." });
          }

          // Handle redirect for cart update
          if (req.query.from === 'cart') {
              req.session.returnToCart = true;
              return res.json({
                  success: true,
                  message: "Profile updated successfully! Redirecting to cart...",
                  returnToCart: true
              });
          }

          return res.json({ success: true, message: "Profile updated successfully!" });
      });

  } catch (error) {
      console.error("Profile update error:", error);
      return res.status(500).json({ success: false, message: "Failed to update profile." });
  }
};


const fs = require("fs");
const sharp = require("sharp");
const path = require("path");


exports.updateProfilePic = async (req, res) => {
    try {
        const userId = req.params.id;

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        console.log(req.file); // Log file details

        // Define upload path
        const uploadDir = path.join(__dirname, "../uploads");

        // Ensure uploads folder exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Define file name and path
        const fileName = `profile_${userId}.png`;
        const filePath = path.join(uploadDir, fileName);

        // Process the image using Sharp and save it
        await sharp(req.file.path)
            .resize(300, 300) 
            .toFormat("png")
            .toFile(filePath);

        // Remove the original uploaded file to save space
        fs.unlinkSync(req.file.path);

        // Update the user's profile picture path in the database
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.profilePic = `/uploads/${fileName}`; // Save relative path
        await user.save();

        res.status(200).json({ message: "Profile picture updated successfully!", filePath: user.profilePic });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.removeProfilePic = async (req, res) => {
  try {
      const userId = req.params.id;
      const user = await User.findById(userId);

      if (!user) {
          return res.status(404).json({ success: false, message: "User not found" });
      }

      user.profilePic = ""; // Remove the profile picture field
      await user.save();

      res.status(200).json({ success: true, message: "Profile picture removed successfully" });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Internal server error" });
  }
};
exports.checkBlockedStatus = async (req, res, next) => {
  try {
      if (!req.session.userId) {
          return next(); // No user session, move to next middleware
      }

      const user = await User.findById(req.session.userId);

      if (!user) {
          req.session.destroy((err) => {
              if (err) {
                  return res.status(500).json({ message: "Error logging out" });
              }
              res.clearCookie("connect.sid");
              return res.redirect("/product/home"); // Redirect to home if user not found
          });
          return;
      }

      if (user.isBlock) {
          req.session.destroy((err) => {
              if (err) {
                  return res.status(500).json({ message: "Error logging out" });
              }
              res.clearCookie("connect.sid"); // Clear session cookie
              return res.redirect("/product/home"); // Redirect to login page
          });
      } else {
          next();
      }
  } catch (error) {
      console.error("Error in checkBlockedStatus:", error);
      res.status(500).json({ message: "Internal Server Error" });
  }
};









