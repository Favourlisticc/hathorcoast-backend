const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { adminMiddleware } = require('../../middleware');
const TokenBlacklist = require('../../models/TokenBlacklist');
const Landlord = require('../../models/Landlord');
const Agent = require('../../models/Agent');
const Admin = require('../../models/Admin');

// Generic suspension function
const suspendUser = async (Model, userId, adminId, reason, session) => {
  const user = await Model.findByIdAndUpdate(
    userId,
    {
      status: 'suspended',
      suspensionDetails: {
        reason,
        suspendedAt: new Date(),
        suspendedBy: adminId
      }
    },
    { 
      new: true,
      session,
      select: '-password' 
    }
  );

  if (!user) {
    throw new Error('User not found');
  }

  // Blacklist all tokens for this user
  await TokenBlacklist.create([{
    token: '*',
    userId: user._id,
    reason: 'Account suspended',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  }], { session });

  return user;
};

// Generic reactivation function
const reactivateUser = async (Model, userId, session) => {
  const user = await Model.findByIdAndUpdate(
    userId,
    {
      status: 'active',
      $unset: { suspensionDetails: "" }
    },
    { 
      new: true,
      session,
      select: '-password' 
    }
  );

  if (!user) {
    throw new Error('User not found');
  }

  // Remove all blacklisted tokens for this user
  await TokenBlacklist.deleteMany({ userId: user._id }, { session });

  return user;
};

// Suspend routes for different user types
const createSuspensionRoute = (userType, Model) => {
  router.post(`/${userType}/:id/suspend`, adminMiddleware, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { reason } = req.body;
      const userId = req.params.id;
      
      if (!reason) {
        return res.status(400).json({ 
          success: false,
          message: 'Suspension reason is required' 
        });
      }

      // Additional checks for admin suspension
      if (userType === 'admin') {
        const targetAdmin = await Admin.findById(userId);
        
        if (!targetAdmin) {
          return res.status(404).json({
            success: false,
            message: 'Admin not found'
          });
        }

        // Prevent superadmin suspension
        if (targetAdmin.role === 'superadmin') {
          return res.status(403).json({
            success: false,
            message: 'Superadmin cannot be suspended'
          });
        }

        // Prevent self-suspension
        if (targetAdmin._id.toString() === req.admin._id.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Admins cannot suspend themselves'
          });
        }
      }

      const suspendedUser = await suspendUser(Model, userId, req.admin._id, reason, session);

      await session.commitTransaction();

      res.json({
        success: true,
        message: `${userType} suspended successfully`,
        data: {
          user: suspendedUser,
          suspensionDetails: suspendedUser.suspensionDetails
        }
      });

    } catch (error) {
      await session.abortTransaction();
      res.status(500).json({ 
        success: false,
        message: `Error suspending ${userType}`, 
        error: error.message 
      });
    } finally {
      session.endSession();
    }
  });

  // Reactivation route
  router.post(`/${userType}/:id/reactivate`, adminMiddleware, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const reactivatedUser = await reactivateUser(Model, req.params.id, session);

      await session.commitTransaction();

      res.json({
        success: true,
        message: `${userType} reactivated successfully`,
        data: { user: reactivatedUser }
      });

    } catch (error) {
      await session.abortTransaction();
      res.status(500).json({ 
        success: false,
        message: `Error reactivating ${userType}`, 
        error: error.message 
      });
    } finally {
      session.endSession();
    }
  });
};

// Create suspension routes for each user type
createSuspensionRoute('landlord', Landlord);
createSuspensionRoute('agent', Agent);
createSuspensionRoute('admin', Admin);

// Add verification endpoint
router.get('/verify/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin ID format'
      });
    }

    const admin = await Admin.findById(id)
      .select('-password -passwordResetToken -passwordResetExpires')
      .lean();
    
    if (!admin) {
      return res.status(404).json({ 
        success: false,
        message: 'Admin not found' 
      });
    }

    // Create verification object
    const verificationData = {
      id: admin._id,
      name: `${admin.firstName} ${admin.lastName}`,
      role: admin.role,
      email: admin.email,
      status: admin.status,
      isActive: admin.isActive,
      verificationDetails: {
        verifiedAt: new Date().toISOString(),
        verificationId: new mongoose.Types.ObjectId(),
      }
    };

    // If admin is suspended, include suspension details
    if (admin.status === 'suspended' && admin.suspensionDetails) {
      verificationData.suspensionDetails = {
        reason: admin.suspensionDetails.reason,
        suspendedAt: admin.suspensionDetails.suspendedAt,
        suspendedBy: admin.suspensionDetails.suspendedBy,
      };
    }

    // Add last login if available
    if (admin.lastLogin) {
      verificationData.lastLogin = admin.lastLogin;
    }

    // Add creation date
    verificationData.createdAt = admin.createdAt;

    return res.status(200).json({
      success: true,
      message: 'Admin verified successfully',
      data: verificationData
    });

  } catch (error) {
    console.error('Admin verification error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error verifying admin',
      error: error.message 
    });
  }
});

module.exports = router;
