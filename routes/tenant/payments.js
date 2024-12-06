const express = require('express');
const router = express.Router();
const Payment = require('../../models/Payment');
const Invoice = require('../../models/Invoice');
const Property = require('../../models/Property');
const { authMiddleware } = require('../../middleware');

// Get pending invoices for tenant
router.get('/invoices', authMiddleware, async (req, res) => {
  try {
    const invoices = await Invoice.find({
      tenant: req.user._id,
      status: 'Pending'
    })
    .populate('property', 'propertyName propertyCode')
    .populate('landlord', 'firstName lastName')
    .sort({ dueDate: 1 });

    res.json(invoices);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching invoices', 
      error: error.message 
    });
  }
});

// Initiate payment
router.post('/initiate', authMiddleware, async (req, res) => {
  try {
    const { invoiceId, paymentMethod } = req.body;

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      tenant: req.user._id,
      status: 'Pending'
    }).populate('property landlord');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    // Create payment record
    const payment = new Payment({
      property: invoice.property._id,
      tenant: req.user._id,
      invoice: invoice._id,
      amount: invoice.total,
      paymentMethod,
      status: 'Pending',
      createdBy: req.user._id // Assuming tenant can create payment
    });

    await payment.save();

    // Here you would integrate with your payment gateway
    // For example, Paystack or Flutterwave
    
    res.json({
      success: true,
      payment: payment,
      // Include payment gateway initialization data here
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error initiating payment', 
      error: error.message 
    });
  }
});

// Payment webhook (for payment gateway callbacks)
router.post('/webhook', async (req, res) => {
  // Verify webhook signature from payment gateway
  
  try {
    const { paymentReference, status } = req.body;

    const payment = await Payment.findOne({ paymentReference });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    payment.status = status === 'successful' ? 'Completed' : 'Failed';
    await payment.save();

    if (status === 'successful') {
      // Update invoice status
      await Invoice.findByIdAndUpdate(payment.invoice, {
        status: 'Paid'
      });

      // Update property financials
      const property = await Property.findById(payment.property);
      if (property) {
        property.financials.totalRevenue += payment.amount;
        await property.save();
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 