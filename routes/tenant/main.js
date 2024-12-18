const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Tenant = require('../../models/Tenant');
const SupportTicket = require('../../models/SupportTicket'); // Assuming you have a Ticket model
const { authMiddleware, checkTenantStatus } = require('../../middleware');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const Property = require('../../models/Property');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' });

// Tenant Signin
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the tenant by email
    const tenant = await Tenant.findOne({ 'contactInfo.email': email });
    if (!tenant) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if tenant is suspended
    if (tenant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Account suspended',
        suspensionDetails: {
          reason: tenant.suspensionDetails?.reason,
          suspendedAt: tenant.suspensionDetails?.suspendedAt
        }
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, tenant.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        id: tenant._id, 
        role: 'tenant', 
        status: tenant.status 
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1d' }
    );

    res.status(200).json({
      message: 'Signin successful',
      token,
      tenant: {
        id: tenant._id,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        email: tenant.contactInfo.email,
        status: tenant.status
      }
    });
  } catch (error) {
    console.error('Tenant signin error:', error);
    res.status(500).json({ message: 'Error signing in', error: error.message });
  }
});

// Fetch tenant profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenant._id).select('-password');
    
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    res.status(200).json(tenant);
  } catch (error) {
    console.error('Fetch tenant profile error:', error);
    res.status(500).json({ message: 'Error fetching tenant profile', error: error.message });
  }
});

// Update tenant profile
router.put('/profile', authMiddleware, upload.single('profileImage'), async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber } = req.body;
    const tenant = await Tenant.findById(req.tenant._id);

    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    // Update avatar if a new file is uploaded
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      tenant.profileImage = result.secure_url;
    }

    // Update fields
    if (firstName) tenant.firstName = firstName;
    if (lastName) tenant.lastName = lastName;
    if (email) tenant.contactInfo.email = email;
    if (phoneNumber) tenant.contactInfo.phoneNumber = phoneNumber;

    await tenant.save();

    res.status(200).json({ message: 'Profile updated successfully', profile: tenant });
  } catch (error) {
    console.error('Update tenant profile error:', error);
    res.status(500).json({ message: 'Error updating tenant profile', error: error.message });
  }
});

router.get('/tenant/:id', authMiddleware, async (req, res) => {
  const userId = req.params.id  // Fix: access the id parameter correctly
  try {
    const lease = await Property.findOne({ currentTenant: userId, status: 'Occupied' })
      .populate('landlord', 'firstName lastName email phoneNumber')
      .populate('currentTenant', 'dates.startDate dates.endDate')
      .lean();

    if (!lease) {
      console.log('No active lease found')
      return res.json({ message: 'No active lease found' });
    }

    console.log(lease)
    res.json(lease);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Error fetching lease', error: error.message });
  }
});


// Route to get KYC status
router.get('/kyc-status', authMiddleware, async (req, res) => {
  try {
    // Assuming you have middleware to get the logged-in user's ID
    const tenent = await Tenant.findById(req.tenant._id).select('-password');


    if (!tenent) {
      console.log('Landlord not found')
      return res.status(404).json({ message: 'Landlord not found' });
    }


    return res.status(200).json({ kycStatus: tenent.kycStatus });
   
  } catch (error) {
    console.log('Error fetching KYC status:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
