const mongoose = require('mongoose');

const leaseSchema = new mongoose.Schema({
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  rentAmount: {
    type: Number,
    required: true
  },
  securityDeposit: {
    type: Number,
    required: true
  },
  leaseTerms: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Expired', 'Terminated'],
    default: 'Active'
  }
}, { timestamps: true });

const Lease = mongoose.model('Lease', leaseSchema);
module.exports = Lease;