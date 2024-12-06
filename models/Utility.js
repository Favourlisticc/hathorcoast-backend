const mongoose = require('mongoose');

const utilitySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Utility = mongoose.model('Utility', utilitySchema);

module.exports = Utility;

