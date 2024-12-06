const mongoose = require('mongoose');

const evictionSchema = new mongoose.Schema({
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
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  noticeDate: {
    type: Date,
    required: true
  },
  scheduledEvictionDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  documents: [{
    type: String,  // URLs to eviction-related documents
  }],
  notes: {
    type: String,
    required: false,  // Make notes optional
    default: null  // Set default to null
  },
  legalProceedings: {
    courtDate: Date,
    courtDecision: String,
    legalFees: Number
  },
  actualEvictionDate: Date,
  // Add any other relevant fields
}, { timestamps: true });

const Eviction = mongoose.model('Eviction', evictionSchema);

module.exports = Eviction;
