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

router.post('/create', authMiddleware, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch landlord details from the request
    const landlordId = req.landlord._id;
    const landlord = await Landlord.findById(landlordId).select('-password');

    if (!landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    const tenantData = req.body; // Read tenant data from the request body
   

    // Validate required fields
    if (!tenantData.title || !tenantData.firstName || !tenantData.lastName || !tenantData.contactInfo?.email) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Check for existing tenant with the same email
    const existingTenant = await Tenant.findOne({ 'contactInfo.email': tenantData.contactInfo.email });
    if (existingTenant) {
      return res.status(409).json({ message: 'A tenant with this email already exists' });
    }

    // Save tenant data, including the landlord ID
    const newTenant = await Tenant.create([{
      title: tenantData.title,
      firstName: tenantData.firstName,
      lastName: tenantData.lastName,
      dateOfBirth: tenantData.dateOfBirth,
      password: tenantData.password,
      contactInfo: {
        email: tenantData.contactInfo.email,
        phoneNumber: tenantData.contactInfo.phoneNumber,
      },
      currentAddress: tenantData.currentAddress,
      nextOfKin: tenantData.nextOfKin,
      landlord: landlordId, // Associate the tenant with the landlord
    }], { session });

    // Commit transaction
    await session.commitTransaction();

    res.status(201).json({
      status: 'success',
      message: 'Tenant created successfully.',
      data: {
        tenant: {
          id: newTenant[0]._id,
          email: newTenant[0].contactInfo.email,
        },
      },
    });
  } catch (error) {
    // Abort transaction in case of an error
    await session.abortTransaction();
    console.error('Error creating tenant:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    session.endSession();
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
     
   

    res.status(200).json({
      message: 'Tenants fetched successfully',
      tenants,
      totalTenants: tenants.length
    });
  } catch (error) {
    console.log('Fetch tenants error:', error);
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
