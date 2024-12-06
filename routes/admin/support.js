const express = require('express');
const router = express.Router();
const SupportTicket = require('../../models/SupportTicket');
const { adminMiddleware } = require('../../middleware');

// Get all support tickets from both landlords and tenants
router.get('/support-tickets', adminMiddleware, async (req, res) => {
  try {
    const tickets = await SupportTicket.find()
      .populate('tenant', 'firstName lastName contactInfo.email')
      .populate('landlord', 'personalInfo.firstName personalInfo.lastName contactInfo.email');
    
    const formattedTickets = tickets.map(ticket => ({
      ...ticket.toObject(),
      user: ticket.tenant || ticket.landlord,
      userType: ticket.tenant ? 'tenant' : 'landlord'
    }));

    res.json(formattedTickets);
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    res.status(500).json({ message: 'Error fetching support tickets', error: error.message });
  }
});

// Get a single support ticket
router.get('/:id', adminMiddleware, async (req, res) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id).populate('user', 'firstName lastName email');
    if (!ticket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching support ticket', error: error.message });
  }
});

// Update a support ticket (e.g., resolve or assign)
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const updatedTicket = await SupportTicket.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedTicket) {
      return res.status(404).json({ message: 'Support ticket not found' });
    }
    res.json(updatedTicket);
  } catch (error) {
    res.status(500).json({ message: 'Error updating support ticket', error: error.message });
  }
});

module.exports = router;
