const express = require('express');
const router = express.Router();
const Invoice = require('../../models/Invoice');
const Property = require('../../models/Property');
const Tenant = require('../../models/Tenant');
const { adminMiddleware } = require('../../middleware');

// Create new invoice
router.post('/create', adminMiddleware, async (req, res) => {
  try {
    const { 
      property, 
      tenant,
      landlord,
      dueDate, 
      items, 
      notes, 
      subtotal, 
      tax, 
      total 
    } = req.body;

    // Validate property exists
    const propertyExists = await Property.findById(property);
    if (!propertyExists) {
      return res.status(400).json({ message: 'Invalid property' });
    }

    // Validate tenant exists
    const tenantExists = await Tenant.findById(tenant);
    if (!tenantExists) {
      return res.status(400).json({ message: 'Invalid tenant' });
    }

    // Create new invoice
    const invoice = new Invoice({
      property,
      tenant,
      landlord,
      dueDate,
      items: items.map(item => ({
        description: item.description,
        amount: item.amount,
        quantity: item.quantity,
        total: item.amount * item.quantity
      })),
      notes,
      amount: total, // Add the total amount
      subtotal,
      tax,
      total,
      status: 'Pending',
      datePrepared: new Date()
    });

    // Generate property code
    const count = await Invoice.countDocuments();
    invoice.invoiceCode = `INV-${String(count + 1).padStart(6, '0')}`;

    await invoice.save();

    // Populate the response with property and tenant details
    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate('property', 'propertyName propertyAddress')
      .populate('tenant', 'firstName lastName contactInfo');

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      invoice: populatedInvoice
    });

  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating invoice', 
      error: error.message 
    });
  }
});

// Get all invoices with pagination and filtering
router.get('/invoices', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    let query = {};

    // Search functionality
    if (search) {
      query.$or = [
        { invoiceCode: { $regex: search, $options: 'i' } },
      ];
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Date range filter
    if (startDate && endDate) {
      query.datePrepared = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const invoices = await Invoice.find(query)
      .populate('property', 'propertyName')
      .populate('tenant', 'firstName lastName')
      .sort({ datePrepared: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Invoice.countDocuments(query);

    res.json({
      success: true,
      data: {
        invoices,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    console.error('Fetch invoices error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching invoices', 
      error: error.message 
    });
  }
});

// Get single invoice
router.get('/:id', adminMiddleware, async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('property')
      .populate('tenant');
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching invoice', error: error.message });
  }
});

// Update invoice
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: 'Error updating invoice', error: error.message });
  }
});

// Delete invoice
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting invoice', error: error.message });
  }
});

module.exports = router; 