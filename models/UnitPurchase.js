const mongoose = require('mongoose');

const UnitPurchaseSchema = new mongoose.Schema({
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  units: {
    type: Number,
    required: true
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'referrerType'
  },
  referrerType: {
    type: String,
    enum: ['Agent', 'Landlord', 'Tenant']
  },
  commission: {
    amount: Number,
    status: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending'
    },
    paidAt: Date
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  paymentReference: String,
  transactionId: String
}, { timestamps: true });

const UnitPurchase = mongoose.model('UnitPurchase', UnitPurchaseSchema);

module.exports = UnitPurchase; 