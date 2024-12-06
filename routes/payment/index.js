const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authMiddleware } = require('../../middleware');
const crypto = require('crypto');
const PaymentIntent = require('../../models/PaymentIntent');

// Initialize payment
router.post('/initialize', authMiddleware, async (req, res) => {
  try {
    const { amount, email, metadata } = req.body;
    
    // Generate unique reference
    const reference = 'UNIT_' + crypto.randomBytes(8).toString('hex').toUpperCase();
    
    // Initialize payment with Paystack
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        amount, // amount in kobo
        email,
        reference,
        metadata: {
          ...metadata,
          userId: req.landlord._id,
        },
        callback_url: `${process.env.FRONTEND_URL}/payment/verify`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Store payment intent in database
    await PaymentIntent.create({
      reference,
      amount: amount / 100, // Convert back to Naira
      email,
      metadata,
      userId: req.landlord._id,
      status: 'pending',
    });

    res.status(200).json({
      success: true,
      data: {
        authorizationUrl: response.data.data.authorization_url,
        reference: reference,
      },
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || 'Payment initialization failed',
    });
  }
});

module.exports = router; 