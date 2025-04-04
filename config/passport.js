const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User"); // Fixed path

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails[0].value; // Get Google email
          
          //  Check if user exists in DB by email
          let user = await User.findOne({ emailId: email });

          if (user) {
            //  Step 2: If user exists but has no googleId, update it
            if (!user.googleId) {
              user.googleId = profile.id;
              await user.save();
            }
            return done(null, user); //  Log the user in
          }

          // Step 3: If user does not exist, deny access (admin should create the user first)
          return done(null, false, { message: "User not registered. Contact admin." });

        } catch (error) {
          return done(error, false);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });
};



