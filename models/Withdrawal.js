const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema({
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [1000, 'Minimum withdrawal amount is ₦1,000']
  },
  status: {
    type: String,
    enum: ['pending','completed','cancelled'],
    default: 'pending'
  },
  bankDetails: {
    bankName: {
      type: String,
      required: true
    },
    accountNumber: {
      type: String,
      required: true,
      match: [/^\d{10}$/, 'Please enter a valid account number']
    },
    accountName: {
      type: String,
      required: true
    },
    accountType: {
      type: String,
      enum: ['savings', 'current']
    }
  },
  processedDate: Date,
  remarks: String,
  failureReason: String,
  metadata: {
    type: Map,
    of: String
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Generate transaction reference before saving
WithdrawalSchema.pre('save', function(next) {
  if (!this.transactionReference) {
    this.transactionReference = 'WTH' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
  }
  next();
});

// Virtual for formatted amount
WithdrawalSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN'
  }).format(this.amount);
});

// Indexes
WithdrawalSchema.index({ agent: 1, createdAt: -1 });
WithdrawalSchema.index({ status: 1 });
WithdrawalSchema.index({ transactionReference: 1 }, { unique: true, sparse: true });

const Withdrawal = mongoose.model('Withdrawal', WithdrawalSchema);

module.exports = Withdrawal; 