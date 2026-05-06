const jwt = require("jsonwebtoken");
const User = require("../models/User");

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = req.cookies.token || (header && header.replace("Bearer ", ""));

    if (!token) return res.status(401).json({ message: "Please login again" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return res.status(401).json({ message: "Please login again" });

    req.user = user;
    next();
  } catch (error) {
    res.clearCookie("token");
    res.status(401).json({ message: "Please login again" });
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};

module.exports = { adminOnly, auth, signToken };
