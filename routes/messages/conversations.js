const express = require('express');
const router = express.Router();
const Conversation = require('../../models/Conversation');
const Message = require('../../models/Message');
const Notification = require('../../models/Notification');
const { authMiddleware } = require('../../middleware');

// Get all conversations for a user
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Get ID and type based on which user property exists
    const userId = req.agent?._id || req.tenant?._id || req.landlord?._id;
    let userType = 'agent';
    if (req.tenant?._id) userType = 'tenant';
    if (req.landlord?._id) userType = 'landlord';
    
    const query = {
      [`${userType}`]: userId,
      isActive: true
    };
    
    const conversations = await Conversation.find(query)
      .populate('landlord', 'firstName lastName email phoneNumber profileImage')
      .populate('tenant', 'firstName lastName contactInfo.email contactInfo.phoneNumber profileImage')
      .populate('agent', 'firstName lastName email phoneNumber profileImage')
      .populate('lastMessage')
      .sort('-updatedAt');
    
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages for a conversation
router.get('/:conversationId/messages', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await Message.find({ conversation: conversationId })
      .sort('createdAt')
      .limit(50); // Paginate if needed
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a new message
router.post('/:conversationId/messages', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { text, recipientId, recipientType } = req.body;
    
    const senderId = req.agent?._id || req.tenant?._id || req.landlord?._id;
    let senderType = 'Agent';
    if (req.tenant?._id) senderType = 'Tenant';
    if (req.landlord?._id) senderType = 'Landlord';

    // Debug log
    console.log('Creating message with:', {
      senderId,
      senderType,
      recipientId,
      recipientType
    });

    const message = await Message.create({
      conversation: conversationId,
      sender: senderId,
      senderType,
      recipient: recipientId,
      recipientType: recipientType,
      text
    });

    // Update conversation's lastMessage
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: new Date()
    });

    // Create notification with proper types
    const notification = await Notification.create({
      recipient: recipientId,
      recipientType, // Use the recipientType directly since it's already formatted
      type: 'NEW_MESSAGE',
      message: `New message from ${senderType}`,
      data: {
        conversationId,
        messageId: message._id,
        senderId,
        senderType
      }
    });

    // Debug log
    console.log('Created notification:', notification);

    res.json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Create a new conversation
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { participantId, participantType } = req.body;
    
    // Get creator ID and type
    const creatorId = req.agent?._id || req.tenant?._id || req.landlord?._id;
    let creatorType = 'agent';
    if (req.tenant?._id) creatorType = 'tenant';
    if (req.landlord?._id) creatorType = 'landlord';

    // Check if conversation already exists
    const existingConversation = await Conversation.findOne({
      [creatorType]: creatorId,
      [participantType.toLowerCase()]: participantId,
      isActive: true
    });

    if (existingConversation) {
      return res.json(existingConversation);
    }

    // Create new conversation
    const conversation = await Conversation.create({
      [creatorType]: creatorId,
      [participantType.toLowerCase()]: participantId,
      isActive: true
    });

    // Populate the conversation
    const populatedConversation = await Conversation.findById(conversation._id)
      .populate('landlord', 'firstName lastName')
      .populate('tenant', 'firstName lastName')
      .populate('agent', 'firstName lastName');

    res.json(populatedConversation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Mark messages as read
router.patch('/:conversationId/read', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.agent?._id || req.tenant?._id || req.landlord?._id;

    // Mark messages as read
    await Message.updateMany(
      {
        conversation: conversationId,
        recipient: userId,
        read: false
      },
      { read: true }
    );

    // Mark related notifications as read
    await Notification.updateMany(
      {
        recipient: userId,
        'data.conversationId': conversationId,
        type: 'NEW_MESSAGE',
        read: false
      },
      { read: true }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Get unread message count
router.get('/unread', authMiddleware, async (req, res) => {
  try {
    const userId = req.agent?._id || req.tenant?._id || req.landlord?._id;
    
    const unreadCount = await Message.countDocuments({
      recipient: userId,
      read: false
    });

    res.json({ unreadCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

module.exports = router;