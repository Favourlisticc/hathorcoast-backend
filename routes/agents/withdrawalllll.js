const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware');
const Agent = require('../../models/Agent');
const Withdrawal = require('../../models/Withdrawal');

// Request withdrawal
router.post('/request', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { amount, withdrawalType } = req.body;
    const agent = await Agent.findById(req.agent._id).session(session);

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Validate withdrawal amount
    if (amount > agent.commission.balance) {
      throw new Error('Insufficient balance');
    }

    if (amount < agent.commission.withdrawalSettings.minimumWithdrawalAmount) {
      throw new Error(`Minimum withdrawal amount is ₦${agent.commission.withdrawalSettings.minimumWithdrawalAmount}`);
    }

    // Create withdrawal request
    const withdrawal = await Withdrawal.create([{
      agent: agent._id,
      amount,
      withdrawalType,
      bankDetails: agent.bankDetails
    }], { session });

    // Update agent's commission balance
    agent.commission.balance -= amount;
    agent.commission.withdrawalHistory.push({
      amount,
      status: 'pending',
      withdrawalType,
      requestDate: new Date()
    });

    await agent.save({ session });
    await session.commitTransaction();

    res.status(201).json({
      success: true,
      data: withdrawal[0]
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(400).json({
      success: false,
      error: error.message
    });
  } finally {
    session.endSession();
  }
});

// Get withdrawal history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ agent: req.agent._id })
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      data: withdrawals
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});


// GET /api/withdrawals - Fetch all withdrawal requests
router.get('/table', async (req, res) => {
  try {
    // Fetch all withdrawals with agent and bank details populated
    const withdrawals = await Withdrawal.find()
      .populate('agent', 'firstName lastName phoneNumber') // Populate agent details
      .sort({ createdAt: -1 }); // Sort by most recent

    res.status(200).json({
      success: true,
      withdrawals,
    });
  } catch (error) {
    console.error('Error fetching withdrawals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;