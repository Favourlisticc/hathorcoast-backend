const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'senderType',
    required: true
  },
  senderType: {
    type: String,
    required: true,
    enum: ['Agent', 'Landlord', 'Tenant']
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'recipientType',
    required: true
  },
  recipientType: {
    type: String,
    required: true,
    enum: ['Agent', 'Landlord', 'Tenant']
  },
  text: {
    type: String,
    required: true
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ sender: 1, senderType: 1 });
messageSchema.index({ recipient: 1, recipientType: 1 });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
