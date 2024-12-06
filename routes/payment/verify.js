const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authMiddleware } = require('../../middleware');
const PaymentIntent = require('../../models/PaymentIntent');
const UnitPurchase = require('../../models/UnitPurchase');

// Verify payment webhook
router.post('/webhook', async (req, res) => {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;

  // Handle the event
  try {
    if (event.event === 'charge.success') {
      const { reference } = event.data;
      
      // Find the payment intent
      const paymentIntent = await PaymentIntent.findOne({ reference });
      if (!paymentIntent) {
        throw new Error('Payment intent not found');
      }

      // Start a transaction
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Update payment intent status
        paymentIntent.status = 'completed';
        paymentIntent.paymentDetails = event.data;
        await paymentIntent.save({ session });

        // If this is a unit purchase, process it
        if (paymentIntent.metadata.type === 'unit_purchase') {
          await processUnitPurchase(paymentIntent, session);
        }

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    }

    res.status(200).send('Webhook processed');
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Webhook processing failed');
  }
});

// Verify payment client-side
router.post('/verify/:reference', authMiddleware, async (req, res) => {
  try {
    const { reference } = req.params;

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    if (response.data.data.status === 'success') {
      // Process the successful payment
      const paymentIntent = await PaymentIntent.findOne({ reference });
      
      if (!paymentIntent) {
        throw new Error('Payment intent not found');
      }

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        paymentIntent.status = 'completed';
        paymentIntent.paymentDetails = response.data.data;
        await paymentIntent.save({ session });

        if (paymentIntent.metadata.type === 'unit_purchase') {
          await processUnitPurchase(paymentIntent, session);
        }

        await session.commitTransaction();

        res.status(200).json({
          success: true,
          data: {
            message: 'Payment verified successfully',
            paymentIntent,
          },
        });
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } else {
      throw new Error('Payment verification failed');
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Payment verification failed',
    });
  }
});

async function processUnitPurchase(paymentIntent, session) {
  // Create unit purchase record
  const unitPurchase = new UnitPurchase({
    landlord: paymentIntent.userId,
    amount: paymentIntent.amount,
    units: paymentIntent.metadata.units,
    paymentReference: paymentIntent.reference,
    status: 'completed',
  });

  await unitPurchase.save({ session });

  // Process referral commission if applicable
  await processReferralCommission(paymentIntent, session);
}

module.exports = router; 