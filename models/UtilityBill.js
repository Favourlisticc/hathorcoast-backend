const mongoose = require('mongoose');

const utilityBillSchema = new mongoose.Schema({
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

const UtilityBill = mongoose.model('UtilityBill', utilityBillSchema);

module.exports = UtilityBill;

