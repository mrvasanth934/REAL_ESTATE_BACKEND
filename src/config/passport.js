const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
const SuperAdmin = require("../models/SuperAdmin");

passport.use(
    new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        passReqToCallback:true
    },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                const googleEmail = profile.emails?.[0]?.value?.toLowerCase();
                if (!googleEmail) {
                    return done(null, false, {
                        message: "Google account email was not received.",
                    })
                }
                let user = await SuperAdmin.findOne({
                    email: googleEmail,
                })
                let userType = "super_admin";

                if (!user) {
                    user = await User.findOne({
                        email: googleEmail,
                    })
                    userType = "tenant_user";
                }
                if (!user) {
                    return done(null, false, {
                        message: "This Google email does not have access to the CRM.",
                    });
                }
                if (!user) {
                    return done(null, false, {
                        message: "This Google email does not have access to the CRM.",
                    });
                }
                if(user.isActive == false){
                    return done(null, false, {
                        message: "login failed due to inactive user account",
                    });
                }
                let deviceId = null
                let deviceInfo = null

                if (req.query.state) {
                    try {
                        const parsedData = JSON.parse(decodeURIComponent(req.query.state))
                        deviceId = parsedData.deviceId
                        deviceInfo = parsedData.deviceInfo
                    } catch (error) {
                        console.error("Error parsing Google OAuth state:", error);
                    }
                }
                const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
                const currentTime = new Date();
                user.lastLoginAt = currentTime;
                if (deviceId) {
                    if (!user.deviceSession) user.deviceSession = [];


                    const existingIndex = user.deviceSession.findIndex(
                        (s) => s.deviceId === deviceId
                    );

                    if (existingIndex > -1) {
                        user.deviceSession[existingIndex].lastLoginAt = currentTime;
                        user.deviceSession[existingIndex].ipAddress = clientIp;
                        user.deviceSession[existingIndex].isActive = true;
                        if (deviceInfo) {
                            user.deviceSession[existingIndex].deviceInformation = deviceInfo;
                        }
                    } else {
                        user.deviceSession.push({
                            deviceId,
                            ipAddress: clientIp,
                            deviceInformation: deviceInfo || {},
                            isActive: true,
                            lastLoginAt: currentTime,
                        });
                    }
                }
                await user.save({ validateBeforeSave: false });

                return done(null, { user, userType, deviceInfo, currentTime });
            } catch (error) {
                return done(error);
            }
        }
    )
)

module.exports = passport;