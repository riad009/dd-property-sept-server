const jwt = require("jsonwebtoken");
const createToken = (payload) => {
  return jwt.sign(payload, "ddproperty");
};

const verifyToken = (token) => {
  return jwt.verify(token, "ddproperty");
};

module.exports = {
  createToken,
  verifyToken,
};
