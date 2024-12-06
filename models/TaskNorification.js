const mongoose = require('mongoose');

const TaskNotificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  link: {
    type: String, // URL to the content or event
  },
  targetAudience: {
    type: String,
    enum: ['landlord', 'admin'],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
});

const TaskNotification = mongoose.model('Notification', NotificationSchema);

module.exports = TaskNotification;