const mongoose = require("mongoose");

const connectDatabase = async (mongoUri) => {
  await mongoose.connect(mongoUri, {
    maxPoolSize: 20
  });
};

module.exports = { connectDatabase };
