const mongoose = require('mongoose');

const CommissionConfigSchema = new mongoose.Schema({
  baseRate: {
    type: Number,
    required: true,
    default: 10 // percentage
  },
  tierRates: [{
    minAmount: Number,
    maxAmount: Number,
    rate: Number
  }],
  bonusRates: [{
    condition: String, // e.g., 'multiple_properties', 'long_term_lease'
    rate: Number
  }],
  effectiveDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
});

const CommissionConfig = mongoose.model('CommissionConfig', CommissionConfigSchema);

module.exports = CommissionConfig;
