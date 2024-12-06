const express = require('express');
const router = express.Router();
const SupportTicket = require('../../models/SupportTicket');
const { authMiddleware, adminMiddleware } = require('../../middleware');

// Create a new ticket
// Create a new ticket for tenant
router.post('/tenant', authMiddleware, async (req, res) => {
  try {
    const { issue, description, priority } = req.body;
    const newTicket = new SupportTicket({
      issue,
      description,
      priority,
      tenant: req.tenant._id,
      userType: 'tenant'
    });

    await newTicket.save();

    res.status(201).json({ message: 'Ticket created successfully', ticket: newTicket });
  } catch (error) {
    console.error('Create tenant ticket error:', error);
    res.status(500).json({ message: 'Error creating tenant ticket', error: error.message });
  }
});

// Create a new ticket for landlord
router.post('/landlord', authMiddleware, async (req, res) => {
  try {
    const { issue, description, priority } = req.body;
    const newTicket = new SupportTicket({
      issue,
      description,
      priority,
      landlord: req.landlord._id,
      userType: 'landlord'
    });

    await newTicket.save();

    res.status(201).json({ message: 'Ticket created successfully', ticket: newTicket });
  } catch (error) {
    console.error('Create landlord ticket error:', error);
    res.status(500).json({ message: 'Error creating landlord ticket', error: error.message });
  }
});

// Get all tickets for the tenant
router.get('/tenant', authMiddleware, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ tenant: req.tenant._id }).sort({ createdAt: -1 });
    res.status(200).json(tickets);
  } catch (error) {
    console.error('Fetch tickets error:', error);
    res.status(500).json({ message: 'Error fetching tickets', error: error.message });
  }
});

// Get all tickets for the landlord
router.get('/landlord', authMiddleware, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ landlord: req.landlord._id }).sort({ createdAt: -1 });
    res.status(200).json(tickets);
  } catch (error) {
    console.error('Fetch tickets error:', error);
    res.status(500).json({ message: 'Error fetching tickets', error: error.message });
  }
});

// Get all tickets for the admin
router.get('/admin', adminMiddleware, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({}).sort({ createdAt: -1 });
    res.status(200).json(tickets);
  } catch (error) {
    console.error('Fetch tickets error:', error);
    res.status(500).json({ message: 'Error fetching tickets', error: error.message });
  }
});

// Get a specific ticket
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const ticket = await SupportTicket.findOne({ _id: req.params.id, tenant: req.tenant._id });
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }
    res.status(200).json(ticket);
  } catch (error) {
    console.error('Fetch ticket error:', error);
    res.status(500).json({ message: 'Error fetching ticket', error: error.message });
  }
});

// Update a ticket (e.g., add a comment)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { comment } = req.body;
    const ticket = await SupportTicket.findOne({ _id: req.params.id, tenant: req.tenant._id });
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    ticket.comments.push({ text: comment, user: req.tenant._id, userType: 'tenant' });
    await ticket.save();

    res.status(200).json({ message: 'Ticket updated successfully', ticket });
  } catch (error) {
    console.error('Update ticket error:', error);
    res.status(500).json({ message: 'Error updating ticket', error: error.message });
  }
});

module.exports = router;

