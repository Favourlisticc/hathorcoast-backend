const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Agent = require('../../models/Agent');
const Withdrawal = require("../../models/Withdrawal")

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


// Check withdrawal eligibility
router.get('/withdraw-status', protect, async (req, res) => {
  try {
    // Fetch the authenticated agent's details
    const agent = await Agent.findById(req.agent._id).select('kycStatus bankDetails commission'); 
      // Adjusted to fetch only relevant fields

    if (!agent) {
      console.log('Agent not found')
      return res.status(404).json({ message: 'Agent not found' });
    }

    // Check if KYC is approved
    if (agent.kycStatus !== 'APPROVED') {
    
      return res.status(400).json({ message: 'KYC verification is not complete. Please complete your KYC.' });
    }

    // Check if bank details are available
    if (!agent.bankDetails || !agent.bankDetails.bankName || !agent.bankDetails.accountNumber || !agent.bankDetails.accountName) {
      console.log('Bank details are missing. Please add your bank details.')
      return res.status(400).json({ message: 'Bank details are missing. Please add your bank details.' });
    }

   
    return res.status(200).json({
      message: 'Eligible for withdrawal.',
      commissionBalance: agent.commission.balance,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// POST /api/withdrawals-request
router.post('/withdrawals-request', protect, async (req, res) => {
  const { amount } = req.body;

  try {
    // Retrieve agent details
    const agent = await Agent.findById(req.agent._id).populate('bankDetails');
    if (!agent) {
      console.log('Agent not found');
      return res.status(404).json({ error: 'Agent not found' });
    }

    const { bankDetails, firstName, lastName, phoneNumber, commission } = agent;

    // Validate amount against withdrawal settings
    const { minimumWithdrawalAmount, maximumWithdrawalAmount } = commission.withdrawalSettings;
    if (amount < minimumWithdrawalAmount || amount > maximumWithdrawalAmount) {
     
      return res.status(400).json({ error: `Amount must be between ₦${minimumWithdrawalAmount} and ₦${maximumWithdrawalAmount}.` });
    }

    // Create a new withdrawal document
    const newWithdrawal = new Withdrawal({
      agent: agent._id,
      amount,
      bankDetails,
      metadata: {
        requesterName: `${firstName} ${lastName}`,
        phoneNumber,
      },
    });

    // Save the withdrawal to the Withdrawal collection
    const savedWithdrawal = await newWithdrawal.save();

    // Update the agent's withdrawal history with amount and reference
    agent.commission.withdrawalHistory.push({
      amount,        // Save the withdrawal amount
    });
    agent.commission.lastWithdrawal = new Date();
    await agent.save();

    // Log and return the successful response

    return res.status(200).json({
      message: 'Withdrawal request submitted successfully',
      withdrawal: savedWithdrawal,
    });
  } catch (error) {
    console.error('Error processing withdrawal request:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});



module.exports = router; 