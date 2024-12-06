const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
  landlord: { type: mongoose.Schema.Types.ObjectId, ref: 'Landlord' },
  issue: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'resolved'],
    default: 'open'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  userType: { type: String, enum: ['tenant', 'landlord'], required: true },
  comments: [{
    text: String,
    user: { type: mongoose.Schema.Types.ObjectId, refPath: 'userType' },
    userType: { type: String, enum: ['tenant', 'landlord', 'admin'] },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

module.exports = SupportTicket;

