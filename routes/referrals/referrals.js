const express = require('express');
const router = express.Router();
const Agent = require('../../models/Agent');
const Tenant = require('../../models/Tenant');
const Landlord = require('../../models/Landlord');
const { authMiddleware } = require('../../middleware');

// Get referral info
router.get('/my-referrals', authMiddleware, async (req, res) => {
  try {
    let user;
    let userModel;

    // Determine user type and model based on role
    if (req.user.role === 'tenant') {
      userModel = Tenant;
      user = req.tenant;
    } else if (req.user.role === 'landlord') {
      userModel = Landlord;
      user = req.landlord;
    } else if (req.user.role === 'agent') {
      userModel = Agent;
      user = req.agent;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid user type'
      });
    }

    // Find user with referral data
    const userWithReferrals = await userModel.findById(user._id)
      .select('referral firstName lastName');

    if (!userWithReferrals) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Populate referral history with correct user models
    const populatedReferralHistory = await Promise.all(
      userWithReferrals.referral.commission.referralHistory.map(async (history) => {
        let referredUserModel;
        switch (history.userType) {
          case 'Landlord':
            referredUserModel = Landlord;
            break;
          case 'Tenant':
            referredUserModel = Tenant;
            break;
          case 'Agent':
            referredUserModel = Agent;
            break;
          default:
            return { ...history.toObject(), referredUser: null };
        }

        const referredUser = await referredUserModel.findById(history.referredUser)
          .select('firstName lastName email');

        return {
          ...history.toObject(),
          referredUser: referredUser ? {
            id: referredUser._id,
            firstName: referredUser.firstName,
            lastName: referredUser.lastName,
            email: referredUser.email
          } : null
        };
      })
    );

    // Return data with populated referral history
    res.status(200).json({
      success: true,
      data: {
        firstName: userWithReferrals.firstName,
        lastName: userWithReferrals.lastName,
        referralCode: userWithReferrals.referral.referralCode,
        commission: {
          balance: userWithReferrals.referral.commission?.balance || 0,
          totalEarned: userWithReferrals.referral.commission?.totalEarned || 0,
          withdrawalHistory: userWithReferrals.referral.commission?.withdrawalHistory || [],
          referralHistory: populatedReferralHistory
        }
      }
    });

  } catch (error) {
    console.error('Referral fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add a route to manually generate referral code
router.post('/generate-code', authMiddleware, async (req, res) => {
  try {
    let user;
    let userModel;

    if (req.user.role === 'tenant') {
      userModel = Tenant;
      user = req.tenant;
    } else if (req.user.role === 'landlord') {
      userModel = Landlord;
      user = req.landlord;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid user type'
      });
    }

    const prefix = req.user.role === 'tenant' ? 'TN' : 'LL';
    const referralCode = prefix + Math.random().toString(36).substr(2, 8).toUpperCase();

    const updatedUser = await userModel.findByIdAndUpdate(
      user._id,
      {
        $set: {
          referral: {
            referralCode,
            commission: {
              balance: 0,
              totalEarned: 0,
              withdrawalHistory: [],
              referralHistory: []
            }
          }
        }
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: {
        referralCode: updatedUser.referral.referralCode
      }
    });
  } catch (error) {
    console.error('Generate referral code error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 