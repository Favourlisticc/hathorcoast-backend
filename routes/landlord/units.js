const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authMiddleware } = require('../../middleware');
const UnitPurchase = require('../../models/UnitPurchase');
const Landlord = require('../../models/Landlord');
const Agent = require('../../models/Agent');
const UnitPrice = require('../../models/UnitPrice');

// Get current unit price
router.get('/price', authMiddleware, async (req, res) => {
  try {
    const currentPrice = await UnitPrice.findOne({ status: 'active' })
      .sort('-effectiveFrom');

    if (!currentPrice) {
      return res.status(404).json({
        success: false,
        error: 'No active unit price found'
      });
    }
    ///me

    res.status(200).json({
      success: true,
      data: {
        price: currentPrice.price,
        effectiveFrom: currentPrice.effectiveFrom,
        effectiveTo: currentPrice.effectiveTo
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get purchase history for the landlord
router.get('/purchases', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const purchases = await UnitPurchase.find({ landlord: req.landlord._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await UnitPurchase.countDocuments({ landlord: req.landlord._id });

    res.status(200).json({
      success: true,
      data: {
        purchases,
        pagination: {
          total,
          pages: Math.ceil(total / limit),
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Purchase units
router.post('/purchase', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, units, paymentReference } = req.body;
    const landlord = await Landlord.findById(req.landlord._id).session(session);

    if (!landlord) {
      throw new Error('Landlord not found');
    }

    // Create unit purchase record
    const unitPurchase = new UnitPurchase({
      landlord: landlord._id,
      amount,
      units,
      paymentReference,
      status: 'completed',
      referredBy: landlord.referral?.referredBy,
      referrerType: landlord.referral?.referrerType
    });

    // If referred by an agent, calculate and add commission
    if (landlord.referral?.referredBy && landlord.referral?.referrerType === 'Agent') {
      const commission = amount * 0.06; // 6% commission
      unitPurchase.commission = {
        amount: commission,
        status: 'pending'
      };

      // Update agent's commission
      const agent = await Agent.findById(landlord.referral.referredBy).session(session);
      if (agent) {
        // Find or create referral history entry
        let referralEntry = agent.referral.commission.referralHistory.find(
          entry => entry.referredUser.toString() === landlord._id.toString()
        );

        if (!referralEntry) {
          agent.referral.commission.referralHistory.push({
            referredUser: landlord._id,
            userType: 'Landlord',
            commission: 0,
            status: 'pending',
            transactions: []
          });
          referralEntry = agent.referral.commission.referralHistory[agent.referral.commission.referralHistory.length - 1];
        }

        // Add transaction to referral history
        if (!referralEntry.transactions) {
          referralEntry.transactions = [];
        }
        
        referralEntry.transactions.push({
          amount: amount,
          commission: commission,
          date: new Date(),
          description: 'Property unit commission'
        });

        // Update commission totals
        referralEntry.commission += commission;
        agent.commission.balance += commission;
        agent.commission.totalEarned += commission;

        await agent.save({ session });
      }
    }

    await unitPurchase.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      data: unitPurchase
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Unit purchase error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

// Get landlord's unit balance
// Get landlord's unit balance
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlord._id).select('amountofunit'); // Fetch amountofunit from the landlord's record
    if (!landlord) {
      return res.status(404).json({
        success: false,
        message: 'Landlord not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        balance: landlord.amountofunit, // Send amountofunit as balance
        lastUpdated: new Date(),       // Add timestamp if needed
      },
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});


module.exports = router; 