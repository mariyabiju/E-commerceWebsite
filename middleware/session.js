module.exports = (req, res, next) => {
    res.locals.user = req.session.userId ? { id: req.session.userId, fname: req.session.fname } : null;
    next();
};

