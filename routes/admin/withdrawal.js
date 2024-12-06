const express = require('express');
const router = express.Router();
const Agent = require('../../models/Agent');
const { adminMiddleware } = require('../../middleware');

// Get all withdrawal requests
router.get('/withdrawal-requests', adminMiddleware, async (req, res) => {
  try {
    const requests = await Agent.aggregate([
      { $unwind: '$commission.withdrawalHistory' },
      {
        $match: {
          'commission.withdrawalHistory.status': { $in: ['pending', 'approved', 'rejected'] }
        }
      },
      {
        $project: {
          agent: {
            _id: '$_id',
            firstName: '$firstName',
            lastName: '$lastName',
            email: '$email',
            bankDetails: '$bankDetails'
          },
          amount: '$commission.withdrawalHistory.amount',
          status: '$commission.withdrawalHistory.status',
          withdrawalType: '$commission.withdrawalHistory.withdrawalType',
          requestDate: '$commission.withdrawalHistory.requestDate',
          remarks: '$commission.withdrawalHistory.remarks',
          _id: '$commission.withdrawalHistory._id'
        }
      },
      { $sort: { requestDate: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: requests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching withdrawal requests',
      error: error.message
    });
  }
});

// Process withdrawal request
router.put('/withdrawal-requests/:requestId', adminMiddleware, async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const { requestId } = req.params;

    const agent = await Agent.findOne({
      'commission.withdrawalHistory._id': requestId
    });

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Withdrawal request not found'
      });
    }

    // Find the withdrawal request
    const withdrawalRequest = agent.commission.withdrawalHistory.id(requestId);

    if (status === 'approved') {
      // Update the withdrawal request
      withdrawalRequest.status = 'approved';
      withdrawalRequest.remarks = remarks;
      withdrawalRequest.processedDate = new Date();

      // Update agent's commission balance
      agent.commission.balance -= withdrawalRequest.amount;
      agent.commission.lastWithdrawal = new Date();

      // You might want to trigger a payment process here
      // await processPayment(agent.bankDetails, withdrawalRequest.amount);
    } else if (status === 'rejected') {
      withdrawalRequest.status = 'rejected';
      withdrawalRequest.remarks = remarks;
      withdrawalRequest.processedDate = new Date();
    }

    await agent.save();

    // Send notification to agent
    // await sendNotification(agent._id, {
    //   type: 'withdrawal_status',
    //   status,
    //   amount: withdrawalRequest.amount
    // });

    res.status(200).json({
      success: true,
      message: `Withdrawal request ${status}`,
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

module.exports = router; 