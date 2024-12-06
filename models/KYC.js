const mongoose = require('mongoose');

const KYCSchema = new mongoose.Schema({
  user: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'user.type'
    },
    type: {
      type: String,
      required: true,
      enum: ['Agent', 'Tenant']
    }
  },
  documents: [{
    type: {
      type: String,
      required: true,
      enum: ['PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID', 'UTILITY_BILL', 'BUSINESS_REGISTRATION', 'OTHER']
    },
    url: {
      type: String,
      required: true
    },
    publicId: String,
    description: String
  }],
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  adminComment: String,
  submittedAt: {
    type: Date,
    default: Date.now
  },
  verifiedAt: Date,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

const KYC = mongoose.model('KYC', KYCSchema); 

module.exports = KYC;
