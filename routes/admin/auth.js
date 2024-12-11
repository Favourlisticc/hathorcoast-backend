const express = require('express');
const router = express.Router();
const Admin = require('../../models/Admin');
const jwt = require('jsonwebtoken');
const Tenant = require('../../models/Tenant');
const Landlord = require('../../models/Landlord');
const Agent = require('../../models/Agent');
const { adminMiddleware, superAdminMiddleware } = require('../../middleware');
const sendEmail = require('../../utils/sendEmail');
const mongoose = require('mongoose');
const TokenBlacklist = require('../../models/TokenBlacklist');
const bcrypt = require('bcrypt');
const Kyc = require("../../models/KYC")

router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Case-insensitive email search
    const admin = await Admin.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') } 
    });

    if (!admin) {
      return res.status(401).json({ message: 'Invalid email' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invali password' });
    }

    // Check account status
    if (!admin.isActive) {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    // Generate token
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Send secure response
    res.json({ 
      token, 
      admin: { 
        id: admin._id, 
        email: admin.email, 
        role: admin.role 
      } 
    });

    console.log(token)

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

// Create a new admin (accessible only by existing admins)
router.post('/create-admin', adminMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, email, password, role } = req.body;

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin with this email already exists' });
    }

    const newAdmin = new Admin({
      firstName,
      lastName,
      email,
      password,
      role,
    });

    await newAdmin.save();

    res.status(201).json({ message: 'New admin created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error creating new admin', error: error.message });
  }
});

// Get pending tenants
router.get('/pending-tenants', adminMiddleware, async (req, res) => {
  try {
    const pendingTenants = await Tenant.find({ isApproved: false });
    res.json(pendingTenants);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending tenants', error: error.message });
  }
});

// Get pending landlords
router.get('/pending-landlords', adminMiddleware, async (req, res) => {
  try {
    const pendingLandlords = await Landlord.find({ isApproved: false })
      .select('firstName lastName email phoneNumber amountofunit amountpaid agentreferral');
    res.json(pendingLandlords);
  
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending landlords', error: error.message });
  }
});

// Get pending agents
router.get('/pending-agents', adminMiddleware, async (req, res) => {
  try {
    const pendingLandlords = await Agent.find({ isApproved: false })
      .select('firstName lastName email');

      res.json(pendingLandlords);
   
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending landlords', error: error.message });
  }
});

// Approve user (tenant or landlord)
router.post('/approve-user', adminMiddleware, async (req, res) => {
  const { userId, userType } = req.body;
  console.log(req.body)

  try {
    let user;
    if (userType === 'tenant') {
      user = await Tenant.findByIdAndUpdate(userId, { isApproved: true }, { new: true });
    } else if (userType === 'landlord') {
      user = await Landlord.findByIdAndUpdate(userId, { isApproved: true }, { new: true });
    } else if (userType === 'agent') {
      user = await Agent.findByIdAndUpdate(userId, { isApproved: true }, { new: true });
    } else {
      return res.status(400).json({ message: 'Invalid user type' });
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Here you might want to send an email to the user notifying them of approval
    await sendEmail({
      email: user.email || user.contactInfo.email,
      subject: 'Account Approved',
      message: 'Your account has been approved. Full access to the platform is now available.'
    });

    res.json({ message: 'User approved successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Error approving user', error: error.message });
  }
});

router.patch('/toggle-admin-status/:adminId', adminMiddleware, superAdminMiddleware, async (req, res) => {
  try {
    const { adminId } = req.params;
    const admin = await Admin.findById(adminId);

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    admin.isActive = !admin.isActive;
    await admin.save();

    res.json({ message: `Admin account ${admin.isActive ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Error toggling admin status', error: error.message });
  }
});

// Fetch details of the admin
router.get('/admin-details', adminMiddleware, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password');
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.json(admin);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin details', error: error.message });
  }
});

router.put('/edit-admin/:adminId', adminMiddleware, async (req, res) => {
  try {
    const { adminId } = req.params;
    const { firstName, lastName, email, role } = req.body;
    const requestingAdmin = req.admin;

    // Check if admin exists
    const targetAdmin = await Admin.findById(adminId);
    if (!targetAdmin) {
      return res.status(404).json({ 
        success: false,
        message: 'Admin not found' 
      });
    }

    // Only superadmin can edit other admins' roles
    if (role && role !== targetAdmin.role) {
      if (requestingAdmin.role !== 'superadmin') {
        return res.status(403).json({ 
          success: false,
          message: 'Only superadmin can change roles' 
        });
      }

      // Prevent changing superadmin's role
      if (targetAdmin.role === 'superadmin') {
        return res.status(403).json({ 
          success: false,
          message: 'Superadmin role cannot be changed' 
        });
      }
    }

    // If email is being changed, check if new email already exists
    if (email && email !== targetAdmin.email) {
      const emailExists = await Admin.findOne({ 
        email, 
        _id: { $ne: adminId } 
      });
      
      if (emailExists) {
        return res.status(400).json({ 
          success: false,
          message: 'Email already in use' 
        });
      }
    }

    // Regular admins can only edit their own profile
    if (requestingAdmin.role !== 'superadmin' && requestingAdmin._id.toString() !== adminId) {
      return res.status(403).json({ 
        success: false,
        message: 'You can only edit your own profile' 
      });
    }

    // Update admin
    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(email && { email }),
        ...(role && { role })
      },
      { 
        new: true, 
        runValidators: true 
      }
    ).select('-password');

    res.json({
      success: true,
      message: 'Admin updated successfully',
      data: { admin: updatedAdmin }
    });

  } catch (error) {
    console.error('Error updating admin:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating admin', 
      error: error.message 
    });
  }
});

// Fetch all admins
router.get('/admins', adminMiddleware, async (req, res) => {
  try {
    const admins = await Admin.find().select('-password');
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admins', error: error.message });
  }
});

// Suspend an admin
router.post('/:id/suspend', adminMiddleware, superAdminMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reason } = req.body;
    const adminId = req.params.id;
    
    if (!reason) {
      return res.status(400).json({ 
        success: false,
        message: 'Suspension reason is required' 
      });
    }

    // Check if target admin is a superadmin
    const targetAdmin = await Admin.findById(adminId);
    if (!targetAdmin) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: 'Admin not found' 
      });
    }

    if (targetAdmin.role === 'superadmin') {
      await session.abortTransaction();
      return res.status(403).json({ 
        success: false,
        message: 'Superadmin cannot be suspended' 
      });
    }

    // Update admin status
    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      {
        status: 'suspended',
        isActive: false,
        suspensionDetails: {
          reason,
          suspendedAt: new Date(),
          suspendedBy: req.admin._id
        }
      },
      { 
        new: true,
        session,
        select: '-password' 
      }
    );

    // Blacklist all existing tokens for this admin
    await TokenBlacklist.create([{
      token: '*', // Special marker for all tokens
      userId: adminId,
      reason: 'Account suspended',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year expiry
    }], { session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Admin suspended successfully',
      data: {
        admin: updatedAdmin,
        suspensionDetails: {
          reason,
          suspendedAt: new Date()
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ 
      success: false,
      message: 'Error suspending admin', 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
});

// Reactivate an admin
router.post('/:id/reactivate', adminMiddleware, superAdminMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const adminId = req.params.id;

    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId,
      {
        status: 'active',
        isActive: true,
        $unset: { suspensionDetails: "" }
      },
      { 
        new: true,
        session,
        select: '-password' 
      }
    );

    if (!updatedAdmin) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: 'Admin not found' 
      });
    }

    // Remove all blacklisted tokens for this admin
    await TokenBlacklist.deleteMany({ userId: adminId }, { session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Admin reactivated successfully',
      data: { admin: updatedAdmin }
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ 
      success: false,
      message: 'Error reactivating admin', 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
});

// Delete an admin
router.delete('/delete/:id', adminMiddleware, superAdminMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const adminId = req.params.id;

    // Check if target admin is a superadmin
    const targetAdmin = await Admin.findById(adminId);
    if (!targetAdmin) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: 'Admin not found' 
      });
    }

    if (targetAdmin.role === 'superadmin') {
      await session.abortTransaction();
      return res.status(403).json({ 
        success: false,
        message: 'Superadmin cannot be deleted' 
      });
    }

    // Delete the admin
    await Admin.findByIdAndDelete(adminId, { session });

    // Blacklist all existing tokens for this admin
    await TokenBlacklist.create([{
      token: '*',
      userId: adminId,
      reason: 'Account deleted',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    }], { session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: 'Admin deleted successfully'
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ 
      success: false,
      message: 'Error deleting admin', 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
});

router.get('/pendingKycs', async (req, res) => {
  try {
    // Fetch all KYCs with status 'PENDING' 
    const pendingKycs = await Kyc.find({ status: 'PENDING' })
      .populate({
        path: 'user.id',
        select: 'firstName lastName phoneNumber email businessName',
      });

    // Format the response
    const formattedKycs = pendingKycs.map(kyc => {
      const userData = kyc.user.id;
      const userType = kyc.user.type; // Get type directly from KYC document
      
      // Base response object
      const response = {
        id: kyc._id,
        type: userType, // Use the type from KYC document
        user: {
          id: userData._id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phoneNumber: userData.phoneNumber,
          email: userData.email,
          type: userType, // Use the type from KYC document
        },
        documents: kyc.documents.map(doc => ({
          type: doc.type,
          documentUrl: doc.documenturl,
          selfieUrl: doc.selfieurl,
          description: doc.description,
        })),
        status: kyc.status,
        adminComment: kyc.adminComment || null,
        submittedAt: kyc.submittedAt,
        verifiedAt: kyc.verifiedAt || null,
      };

      // Add businessName only if user is an Agent
      if (userType === 'Agent' && userData.businessName) {
        response.user.businessName = userData.businessName;
      }

      return response;
    });

    console.log(formattedKycs);

    res.status(200).json({
      success: true,
      data: formattedKycs,
    });
  } catch (error) {
    console.log('Error fetching pending KYCs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending KYCs',
    });
  }
});



module.exports = router;
