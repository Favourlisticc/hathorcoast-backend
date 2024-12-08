const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Agent = require('../../models/Agent');

// Middleware to protect routes
const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.agent = await Agent.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      res.status(401).json({ success: false, message: 'Not authorized' });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

// Get withdrawal history and current balance
router.get('/withdrawal-status', async (req, res) => {
  try {
    const agent = await Agent.findById(req.agent._id)
      .select('commission bankDetails');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        currentBalance: agent.commission.balance,
        totalEarned: agent.commission.totalEarned,
        lastWithdrawal: agent.commission.lastWithdrawal,
        withdrawalHistory: agent.commission.withdrawalHistory,
        withdrawalSettings: agent.commission.withdrawalSettings,
        bankDetails: agent.bankDetails
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching withdrawal status',
      error: error.message
    });
  }
});

// Request a withdrawal
router.post('/request-withdrawal', protect, async (req, res) => {
  try {
    const { amount, withdrawalType } = req.body;
    const agent = await Agent.findById(req.agent._id);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    // Validate bank details
    if (!agent.bankDetails || !agent.bankDetails.accountNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please update your bank details before requesting a withdrawal'
      });
    }

    // Validate withdrawal amount
    const { minimumWithdrawalAmount, maximumWithdrawalAmount } = 
      agent.commission.withdrawalSettings;

    if (amount < minimumWithdrawalAmount || amount > maximumWithdrawalAmount) {
      return res.status(400).json({
        success: false,
        message: `Withdrawal amount must be between ${minimumWithdrawalAmount} and ${maximumWithdrawalAmount}`
      });
    }

    // Check if balance is sufficient
    if (amount > agent.commission.balance) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }

    // Create withdrawal request
    const withdrawalRequest = {
      amount,
      withdrawalType,
      requestDate: new Date(),
      status: 'pending'
    };

    agent.commission.withdrawalHistory.push(withdrawalRequest);
    await agent.save();

    // Notify admin about new withdrawal request
    // ... implement notification logic ...

    res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: withdrawalRequest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing withdrawal request',
      error: error.message
    });
  }
});

// Update withdrawal settings
router.put('/withdrawal-settings', protect, async (req, res) => {
  try {
    const { preferredWithdrawalType } = req.body;
    const agent = await Agent.findById(req.agent._id);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    agent.commission.withdrawalSettings.preferredWithdrawalType = 
      preferredWithdrawalType;
    await agent.save();

    res.status(200).json({
      success: true,
      message: 'Withdrawal settings updated successfully',
      data: agent.commission.withdrawalSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating withdrawal settings',
      error: error.message
    });
  }
});

module.exports = router; 