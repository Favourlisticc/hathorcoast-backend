const Notification = require('../models/Notification'); // You'll need to create this model too

class NotificationService {
  static async send(notification) {
    try {
      const newNotification = new Notification({
        recipient: notification.recipient,
        type: notification.type,
        data: notification.data,
        read: false
      });

      await newNotification.save();

      // Here you could add real-time notification using WebSocket
      // or integrate with an email/SMS service
      console.log('Notification sent:', newNotification);
      
      return newNotification;
    } catch (error) {
      console.error('Notification error:', error);
      throw error;
    }
  }

  static async sendMultiple(notifications) {
    try {
      const notificationPromises = notifications.map(notification => 
        this.send(notification)
      );
      
      return await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Multiple notifications error:', error);
      throw error;
    }
  }

  static async markAsRead(notificationId) {
    try {
      return await Notification.findByIdAndUpdate(
        notificationId,
        { read: true },
        { new: true }
      );
    } catch (error) {
      console.error('Mark as read error:', error);
      throw error;
    }
  }
}

module.exports = NotificationService; 