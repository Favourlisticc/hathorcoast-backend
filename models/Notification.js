const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'recipientType',
    required: true
  },
  recipientType: {
    type: String,
    required: true,
    enum: ['Agent', 'Tenant', 'Landlord']
  },
  type: {
    type: String,
    required: true,
    enum: ['NEW_MESSAGE', 'NEW_TENANT', 'NEW_LANDLORD', 'PROPERTY_UPDATE']
  },
  message: {
    type: String,
    required: true
  },
  data: {
    conversationId: String,
    messageId: mongoose.Schema.Types.ObjectId,
    senderId: mongoose.Schema.Types.ObjectId,
    senderType: String
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;