const mongoose = require('mongoose');

const PaymentIntentSchema = new mongoose.Schema({
  reference: {
    type: String,
    required: true,
    unique: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  metadata: {
    type: Object,
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'userType',
  },
  userType: {
    type: String,
    required: true,
    enum: ['Landlord', 'Agent', 'Tenant'],
    default: 'Landlord',
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  paymentDetails: Object,
}, { timestamps: true });

const PaymentIntent = mongoose.model('PaymentIntent', PaymentIntentSchema);

module.exports = PaymentIntent;