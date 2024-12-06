const express = require('express');
const router = express.Router();
const { adminMiddleware } = require('../../middleware');
const Withdrawal = require('../../models/Withdrawal');
const Agent = require('../../models/Agent');
const { sendWithdrawalStatusEmail } = require('../../utils/emailService');

// Get all withdrawals with pagination and filters
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      startDate, 
      endDate 
    } = req.query;

    const query = {};
    
    if (status) query.status = status;
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const withdrawals = await Withdrawal.find(query)
      .populate('agent', 'firstName lastName email phoneNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Withdrawal.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        withdrawals,
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

// Process withdrawal (approve/reject)
router.post('/:id/:action', adminMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id, action } = req.params;
    const { remarks } = req.body;

    const withdrawal = await Withdrawal.findById(id)
      .populate('agent')
      .session(session);

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.status !== 'pending') {
      throw new Error('Withdrawal has already been processed');
    }

    const agent = await Agent.findById(withdrawal.agent._id).session(session);

    if (action === 'approve') {
      withdrawal.status = 'completed';
      withdrawal.processedDate = new Date();
      withdrawal.processedBy = req.admin._id;
      withdrawal.remarks = remarks;

      // Update agent's withdrawal history
      const withdrawalIndex = agent.commission.withdrawalHistory.findIndex(
        w => w._id.toString() === withdrawal._id.toString()
      );

      if (withdrawalIndex !== -1) {
        agent.commission.withdrawalHistory[withdrawalIndex].status = 'completed';
        agent.commission.withdrawalHistory[withdrawalIndex].processedDate = new Date();
      }

      // Send success email
      await sendWithdrawalStatusEmail(
        agent.email,
        'Withdrawal Approved',
        {
          amount: withdrawal.amount,
          reference: withdrawal.transactionReference,
          status: 'approved',
          date: new Date()
        }
      );

    } else if (action === 'reject') {
      withdrawal.status = 'failed';
      withdrawal.failureReason = remarks;
      withdrawal.processedBy = req.admin._id;

      // Refund the amount to agent's balance
      agent.commission.balance += withdrawal.amount;

      // Update agent's withdrawal history
      const withdrawalIndex = agent.commission.withdrawalHistory.findIndex(
        w => w._id.toString() === withdrawal._id.toString()
      );

      if (withdrawalIndex !== -1) {
        agent.commission.withdrawalHistory[withdrawalIndex].status = 'failed';
        agent.commission.withdrawalHistory[withdrawalIndex].failureReason = remarks;
      }

      // Send rejection email
      await sendWithdrawalStatusEmail(
        agent.email,
        'Withdrawal Rejected',
        {
          amount: withdrawal.amount,
          reference: withdrawal.transactionReference,
          status: 'rejected',
          reason: remarks,
          date: new Date()
        }
      );
    }

    await withdrawal.save({ session });
    await agent.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      success: true,
      data: withdrawal
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

// Get withdrawal statistics
router.get('/statistics', adminMiddleware, async (req, res) => {
  try {
    const stats = await Withdrawal.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const totalWithdrawals = await Withdrawal.countDocuments();
    const pendingAmount = await Withdrawal.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats,
        totalWithdrawals,
        pendingAmount: pendingAmount[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 