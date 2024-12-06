const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  referred: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  landlord: { type: mongoose.Schema.Types.ObjectId, ref: 'Landlord' },
  status: { type: String, enum: ['pending', 'completed', 'expired'], default: 'pending' },
  commissionAmount: { type: Number },
  referralCode: { type: String, unique: true, required: true },
  createdAt: { type: Date, default: Date.now },
  completedAt: Date
});

const Referral = mongoose.model('Referral', referralSchema);
module.exports = Referral;
