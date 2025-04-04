module.exports = (req, res, next) => {
    if (!req.session.admin) {
        return res.redirect("/admin/login"); // Redirect if session is missing
    }
    
    next();
};
