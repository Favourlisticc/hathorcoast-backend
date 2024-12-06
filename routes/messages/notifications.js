const express = require('express');
const router = express.Router();
const Message = require('../../models/Message');
const { authMiddleware } = require('../../middleware');

// Get messages summary (recent messages and unread count)
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const userId = req.agent?._id || req.tenant?._id || req.landlord?._id;
    
    // Get recent messages
    const messages = await Message.find({
      recipient: userId
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('sender', 'firstName lastName')
    .lean();

    // Get unread count
    const unreadCount = await Message.countDocuments({
      recipient: userId,
      read: false
    });

    res.json({
      messages,
      unreadCount
    });
  } catch (error) {
    console.error('Error in messages summary:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Mark message as read
router.patch('/:messageId/read', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.agent?._id || req.tenant?._id || req.landlord?._id;

    const message = await Message.findOneAndUpdate(
      {
        _id: messageId,
        recipient: userId
      },
      { read: true },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json(message);
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

module.exports = router;