
const User = require("../models/User"); // Fixed path
const bcrypt = require("bcrypt");



exports.dashboard = (req, res) => {
  if (req.isAuthenticated()) {
    res.render("dashboard", { user: req.user });
  } else {
    res.redirect("/product/home");
  }
};

exports.logout = (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
    }
    res.redirect("/login");
  });
};
