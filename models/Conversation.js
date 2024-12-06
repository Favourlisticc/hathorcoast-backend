const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  landlord: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
  },
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
  },
  participantType: {
    type: String,
    enum: ['tenant', 'landlord', 'agent'],
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add an index for faster queries
conversationSchema.index({ agent: 1, isActive: 1 });

const Conversation = mongoose.model('Conversation', conversationSchema);
module.exports = Conversation;
