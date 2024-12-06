const express = require('express');
const { authMiddleware } = require('../../middleware');
const Tenant = require('../../models/Tenant');
const Property = require('../../models/Property');
const crypto = require('crypto');
const sendEmail = require('../../utils/sendEmail'); // You'll need to implement this
const Referral = require('../../models/Referral');
const { mongoose } = require('mongoose');
const Landlord = require('../../models/Landlord');
const Agent = require('../../models/Agent');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const fs = require('fs');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 120000 // 120 seconds timeout
});

// Configure multer for file upload
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 2 // Maximum 2 files
  },
  fileFilter: (req, file, cb) => {
    // Allow images and other file types
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'), false);
    }
  }
}).fields([
  { name: 'passport', maxCount: 1 },
  { name: 'identityProof', maxCount: 1 }
]);

// Generate tokens utility
const generateTokens = () => {
  const invitationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  const resetToken = crypto.randomBytes(32).toString('hex');
  const passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  return { invitationCode, resetToken, passwordResetToken };
};

// Update the file upload logic with better error handling and optimization
const uploadToCloudinary = async (file, folder) => {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      resource_type: 'auto',
      timeout: 120000,
      // Add optimization options
      quality: 'auto',
      fetch_format: 'auto',
      flags: 'attachment'
    });
    
    // Clean up the local file
    fs.unlinkSync(file.path);
    return result.secure_url;
  } catch (error) {
    // Clean up the local file even if upload fails
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw error;
  }
};

// Create a new tenant
router.post('/create', authMiddleware, upload, async (req, res) => {
  try {
    // Check for existing tenant with the same email
    const existingTenant = await Tenant.findOne({ 'contactInfo.email': req.body.contactInfo.email });
    if (existingTenant) {
      return res.status(409).json({ message: 'A tenant with this email already exists' });
    }

    if (req.body === "") {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Handle referral code
    let referrer;

    if (req.body.referralCode) {
      referrer = await Promise.all([
        Tenant.findOne({ 'referral.referralCode': req.body.referralCode }),
        Landlord.findOne({ 'referral.referralCode': req.body.referralCode }),
        Agent.findOne({ 'referral.referralCode': req.body.referralCode })
      ]).then(([tenant, landlord, agent]) => tenant || landlord || agent);

      if (!referrer) {
        return res.status(400).json({
          success: false,
          error: 'Invalid referral code'
        });
      }
    }
    // Generate tokens
    const { invitationCode } = generateTokens();

    // Upload files to Cloudinary if they exist
    let passportUrl, identityProofUrl;

    if (req.files) {
      try {
        const uploadPromises = [];

        if (req.files.passport) {
          uploadPromises.push(
            uploadToCloudinary(req.files.passport[0], 'tenants/kyc/passport')
              .then(url => { passportUrl = url; })
          );
        }

        if (req.files.identityProof) {
          uploadPromises.push(
            uploadToCloudinary(req.files.identityProof[0], 'tenants/kyc/identity')
              .then(url => { identityProofUrl = url; })
          );
        }

        // Wait for all uploads to complete
        await Promise.all(uploadPromises);

      } catch (uploadError) {
        console.error('Error uploading files:', uploadError);
        return res.status(500).json({
          status: 'error',
          message: 'Error uploading files. Please try again with smaller files or check your connection.',
          error: uploadError.message
        });
      }
    }

    // Create tenant data with file URLs
    const tenantData = {
      ...req.body,
      landlord: req.landlord._id,
      invitationCode: invitationCode,
      kycStatus: "PENDING",
      kycDocuments: {
        passport: passportUrl,
        identityProof: identityProofUrl,
        identityProofType: req.body.identityProofType,
        uploadedAt: new Date()
      }
    };

    // Use session for transaction
    const session = await mongoose.startSession();
    await session.startTransaction();

    try {
      // Save tenant
      const newTenant = await Tenant.create([tenantData], { session });

      let user;
      let model;

      // Determine user type and model based on role
      if (req.user.role === 'tenant') {
        model = "Tenant";
        user = req.tenant;
      } else if (req.user.role === 'landlord') {
        model = "Landlord";
        user = req.landlord;
      }

      // If there's a referrer, update their referral history
      if (referrer) {
        referrer.referral.commission.referralHistory.push({
          referredUser: user._id,
          userType: model,
          commission: 0, // Will be updated when tenant makes a payment
          status: 'pending'
        });
        await referrer.save({ session });
      }

      // Generate reset URL
      // const resetURL = `${process.env.FRONTEND_URL}/auth/set-password/${resetToken}`;
      const invitationURL = `${process.env.FRONTEND_URL}/auth/tenant-signup?code=${invitationCode}`;

      // Send email
      await sendEmail({
        email: req.body.contactInfo.email,
        subject: 'Welcome to Our Platform - Complete Your Registration',
        html: `
          <h2>Welcome to Our Platform!</h2>
          <p>You have been added as a tenant by your landlord.</p>
          <p>Your invitation code is: <strong>${invitationCode}</strong></p>
          <p>Please complete your registration by following these steps:</p>
          <ol>
            <li>Visit <a href="${invitationURL}">this link</a> and enter your invitation code</li>
            <li>Set up your password to continue</li>
          </ol>
          <p>These links will expire in 2 days for security purposes.</p>
          <p>If you did not request this invitation, please ignore this email.</p>
        `
      });

      await session.commitTransaction();

      res.status(201).json({
        status: 'success',
        message: 'Tenant created successfully. Invitation sent to email.',
        data: {
          tenant: {
            id: newTenant[0]._id,
            email: newTenant[0].contactInfo.email,
            invitationCode
          }
        }
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}); 

// Helper route to verify invitation code
router.post('/verify-invitation', async (req, res) => {
  try {
    const { invitationCode } = req.body;

    const tenant = await Tenant.findOne({ 
      invitationCode,
    });

    if (!tenant) {
      return res.status(400).json({
        status: 'error',
        message: 'Invitation code is invalid'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Invitation code verified',
      data: {
        email: tenant.contactInfo.email
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Error verifying invitation code'
    });
  }
});

// Fetch all tenants for the logged-in landlord
router.get('/', authMiddleware, async (req, res) => {
  try {
    const tenants = await Tenant.find({ landlord: req.landlord._id })
      .select('-documents').populate('property') // Exclude documents for faster query, if not needed
      .sort({ createdAt: -1 }); // Sort by creation date, newest first

    res.status(200).json({
      message: 'Tenants fetched successfully',
      tenants,
      totalTenants: tenants.length
    });
  } catch (error) {
    console.error('Fetch tenants error:', error);
    res.status(500).json({ message: 'Error fetching tenants', error: error.message });
  }
});

// Fetch all unassigned tenants for the logged-in landlord
router.get('/unassigned', authMiddleware, async (req, res) => {
  try {
    const tenants = await Tenant.find({
      property: { $exists: false }
    }).select('-documents'); // Exclude documents for faster query, if not needed

    res.status(200).json({
      message: 'Unassigned tenants fetched successfully',
      count: tenants.length,
      tenants: tenants
    });
  } catch (error) {
    console.error('Fetch unassigned tenants error:', error);
    res.status(500).json({ message: 'Error fetching unassigned tenants', error: error.message });
  }
});

// Fetch all assigned tenants for the logged-in landlord
router.get('/assigned', authMiddleware, async (req, res) => {
  try {
    const tenants = await Tenant.find({ 
      landlord: req.landlord._id,
      property: { $exists: true, $ne: null }
    })
    .select('-documents')
    .populate('property', 'address');

    res.status(200).json({
      message: 'Assigned tenants fetched successfully',
      count: tenants.length,
      tenants: tenants
    });
  } catch (error) {
    console.error('Fetch assigned tenants error:', error);
    res.status(500).json({ message: 'Error fetching assigned tenants', error: error.message });
  }
});

// Get details of a particular tenant
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ _id: req.params.id, landlord: req.landlord._id });
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }
    res.status(200).json({
      message: 'Tenant details fetched successfully',
      tenant: tenant
    });
  } catch (error) {
    console.error('Fetch tenant details error:', error);
    res.status(500).json({ message: 'Error fetching tenant details', error: error.message });
  }
});

// Edit a tenant
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, landlord: req.landlord._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found or you do not have permission to edit' });
    }

    res.status(200).json({ message: 'Tenant updated successfully', tenant });
  } catch (error) {
    res.status(400).json({ message: 'Error updating tenant', error: error.message });
  }
});

// Delete a tenant
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndDelete({ _id: req.params.id, landlord: req.landlord._id });

    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found or you do not have permission to delete' });
    }

    res.status(200).json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error deleting tenant', error: error.message });
  }
});

// Evict a tenant from a property
router.put('/:id/evict', authMiddleware, async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ _id: req.params.id, landlord: req.landlord._id });
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found or you do not have permission to evict' });
    }

    if (!tenant.property) {
      return res.status(400).json({ message: 'Tenant is not currently assigned to any property' });
    }

    const property = await Property.findById(tenant.property);
    if (property) {
      property.currentTenant = undefined;
      property.status = 'Available';
      await property.save();
    }

    tenant.property = undefined;
    await tenant.save();

    res.status(200).json({ 
      message: 'Tenant evicted successfully', 
      tenant: tenant,
      property: property
    });
  } catch (error) {
    console.error('Evict tenant error:', error);
    res.status(400).json({ message: 'Error evicting tenant', error: error.message });
  }
});

// Set password route
router.post('/set-password', async (req, res) => {
  try {
    const { email, password } = req.body;

    const tenant = await Tenant.findOne({
      'contactInfo.email': email
    });

    if (!tenant) {
      return res.status(400).json({ message: 'User does not exist' });
    }

    tenant.password = password;
    tenant.passwordResetToken = undefined;
    tenant.passwordResetExpires = undefined;
    await tenant.save();

    res.status(200).json({ message: 'Password set successfully' });
  } catch (error) {
    res.status(400).json({ message: 'Error setting password', error: error.message });
  }
});

// Admin approval route
router.post('/approve/:id', authMiddleware, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    tenant.isApproved = true;
    await tenant.save();

    // Send approval email to tenant
    await sendEmail({
      email: tenant.contactInfo.email,
      subject: 'Your Account Has Been Approved',
      message: 'Your tenant account has been approved. You can now log in to the platform.',
      html: '<p>Your tenant account has been approved. You can now log in to the platform.</p>'
    });

    res.status(200).json({ message: 'Tenant approved successfully', tenant });
  } catch (error) {
    console.error('Error approving tenant:', error);
    res.status(400).json({ message: 'Error approving tenant', error: error.message });
  }
});

module.exports = router;
