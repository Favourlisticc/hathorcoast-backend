const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
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
  invoice: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Bank Transfer', 'Card', 'Check'],
    required: true
  },
  paymentReference: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
    default: 'Pending'
  },
  date: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  }
}, {
  timestamps: true
});

// Generate payment reference
paymentSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    this.paymentReference = `PAY-${new Date().getFullYear()}-${(count + 1).toString().padStart(6, '0')}`;
  }
  next();
});

// Index for faster queries
paymentSchema.index({ property: 1, date: -1 });
paymentSchema.index({ tenant: 1, date: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentReference: 1 }, { unique: true });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment; 