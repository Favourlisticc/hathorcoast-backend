const mongoose = require('mongoose');

const UnitPriceSchema = new mongoose.Schema({
  price: {
    type: Number,
    required: true
  },
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  effectiveTo: Date,
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  }
}, { timestamps: true });

const UnitPrice = mongoose.model('UnitPrice', UnitPriceSchema);

module.exports = UnitPrice; 