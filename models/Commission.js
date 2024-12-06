const mongoose = require('mongoose');

const CommissionSchema = new mongoose.Schema({
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['rental', 'renewal', 'bonus'],
    default: 'rental'
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled'],
    default: 'pending'
  },
  details: {
    monthlyRent: Number,
    paymentMode: String,
    leaseStartDate: Date,
    leaseEndDate: Date
  },
  paidAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Commission = mongoose.model('Commission', CommissionSchema);

module.exports = Commission;
