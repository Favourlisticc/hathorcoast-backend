const express = require('express');
const router = express.Router();
const KYC = require('../../models/KYC');
const Tenant = require('../../models/Tenant');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { authMiddleware, adminMiddleware } = require('../../middleware');
const fs = require('fs');

// Multer configuration for handling multiple files
const upload = multer({
  storage: multer.diskStorage({}),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'), false);
    }
  }
});

// Submit KYC documents - Agent Route
router.post('/Agent/submit', authMiddleware, upload.array('documents', 5), async (req, res) => {
  try {
    const { documentTypes, descriptions } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No documents provided'
      });
    }

    // Check if KYC already exists
    const existingKYC = await KYC.findOne({
      'user.id': req.agent._id,
      'user.type': 'Agent'
    });

    if (existingKYC && existingKYC.status === 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending KYC verification'
      });
    }

    // Upload files to Cloudinary
    const uploadedDocuments = await Promise.all(
      files.map(async (file, index) => {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'kyc-documents',
          resource_type: 'auto'
        });

        return {
          type: documentTypes[index],
          url: result.secure_url,
          publicId: result.public_id,
          description: descriptions[index]
        };
      })
    );

    const kyc = new KYC({
      user: {
        id: req.agent._id,
        type: 'Agent'
      },
      documents: uploadedDocuments,
      status: 'PENDING'
    });

    await kyc.save();

    res.status(201).json({
      success: true,
      data: kyc
    });
  } catch (error) {
    console.error('KYC submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting KYC documents',
      error: error.message
    });
  }
});

router.post('/Tenant/submit', authMiddleware, upload.array('documents', 5), async (req, res) => {
  try {
    const { documentTypes, descriptions } = req.body;
    const files = req.files;

    // Validate input
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No documents provided'
      });
    }

    if (!documentTypes || documentTypes.length !== files.length) {
      return res.status(400).json({
        success: false,
        message: 'Document types must be provided for each file'
      });
    }

    // Validate document types against enum
    const validTypes = ['PASSPORT', 'DRIVERS_LICENSE', 'NATIONAL_ID', 'UTILITY_BILL', 'BUSINESS_REGISTRATION', 'OTHER'];
    const invalidTypes = documentTypes.filter(type => !validTypes.includes(type));
    if (invalidTypes.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid document type(s): ${invalidTypes.join(', ')}. Valid types are: ${validTypes.join(', ')}`
      });
    }

    // Check if KYC already exists
    const existingKYC = await KYC.findOne({
      'user.id': req.tenant._id,
      'user.type': 'Tenant'
    });

    if (existingKYC && existingKYC.status === 'PENDING') {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending KYC verification'
      });
    }

    // Upload files to Cloudinary with better error handling
    const uploadedDocuments = await Promise.all(
      files.map(async (file, index) => {
        try {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'kyc-documents',
            resource_type: 'auto'
          });

          return {
            type: documentTypes[index],
            url: result.secure_url,
            publicId: result.public_id,
            description: descriptions[index] || ''
          };
        } catch (uploadError) {
          throw new Error(`Failed to upload document ${index + 1}: ${uploadError.message}`);
        }
      })
    );

    const kyc = new KYC({
      user: {
        id: req.tenant._id,
        type: 'Tenant'
      },
      documents: uploadedDocuments,
      status: 'PENDING'
    });

    await kyc.save();

    res.status(201).json({
      success: true,
      data: kyc
    });
  } catch (error) {
    console.error('KYC submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting KYC documents',
      error: error.message
    });
  }
});

// Get KYC status - Agent
router.get('/Agent/status', authMiddleware, async (req, res) => {
  try {
    const kyc = await KYC.findOne({
      'user.id': req.agent._id,
      'user.type': 'Agent'
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: kyc
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC status',
      error: error.message
    });
  }
});

// Get KYC status - Tenant
router.get('/Tenant/status', authMiddleware, async (req, res) => {
  try {
    const kyc = await KYC.findOne({
      'user.id': req.tenant._id,
      'user.type': 'Tenant'
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: kyc
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC status',
      error: error.message
    });
  }
});

// Admin routes
router.get('/admin/submissions', adminMiddleware, async (req, res) => {
  try {
    const { status, userType, page = 1, limit = 10 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (userType) query['user.type'] = userType;

    // Fetch KYC submissions
    const submissions = await KYC.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate({
        path: 'user.id',
        select: 'firstName lastName email contactInfo.email kycDocuments',
        refPath: 'user.type'
      });

    // Fetch tenants with KYC documents, respecting the status filter
    const tenantQuery = {
      'kycDocuments.passport': { $exists: true, $ne: null },
      'kycDocuments.identityProof': { $exists: true, $ne: null }
    };
    
    // Add status filter for tenants if specified
    if (status) {
      tenantQuery.kycStatus = status;
    }
    
    // Add user type filter for tenants
    if (userType && userType !== 'Tenant') {
      tenantQuery._id = null; // Force empty result if filtering for non-tenants
    }

    const tenants = await Tenant.find(tenantQuery)
      .select('firstName lastName contactInfo.email kycDocuments kycStatus kycVerifiedAt')
      .sort({ 'kycDocuments.uploadedAt': -1 });

    // Combine and format the results
    const combinedSubmissions = [
      ...submissions.map(sub => ({
        type: 'kyc_submission',
        status: sub.status,
        createdAt: sub.createdAt,
        user: {
          id: sub.user.id._id,
          firstName: sub.user.id.firstName,
          lastName: sub.user.id.lastName,
          email: sub.user.id.contactInfo?.email || sub.user.id.email,
          type: sub.user.type
        },
        documents: sub.documents
      })),
      ...tenants.map(tenant => ({
        type: 'tenant_kyc',
        status: tenant.kycStatus || 'PENDING', // Use the actual kycStatus
        createdAt: tenant.kycDocuments.uploadedAt,
        verifiedAt: tenant.kycVerifiedAt, // Include verification date
        user: {
          id: tenant._id,
          firstName: tenant.firstName,
          lastName: tenant.lastName,
          email: tenant.contactInfo.email,
          type: 'Tenant'
        },
        documents: {
          passport: tenant.kycDocuments.passport,
          identityProof: tenant.kycDocuments.identityProof,
          identityProofType: tenant.kycDocuments.identityProofType
        }
      }))
    ];

    // Sort combined results by date
    const sortedSubmissions = combinedSubmissions.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Apply pagination to combined results
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedResults = sortedSubmissions.slice(startIndex, endIndex);
    const total = sortedSubmissions.length;

    res.status(200).json({
      success: true,
      data: paginatedResults,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching KYC data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching KYC submissions',
      error: error.message
    });
  }
});

// Verify KYC submission
router.put('/admin/verify/:id', adminMiddleware, async (req, res) => {
  try {
    const { status, adminComment, submissionType } = req.body;

    if (submissionType === 'tenant_kyc') {
      // Handle tenant direct upload verification
      const tenant = await Tenant.findById(req.params.id);
      
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Update tenant's KYC status
      tenant.kycStatus = status;
      tenant.kycVerifiedAt = Date.now();
      tenant.kycVerifiedBy = req.admin._id;
      tenant.kycAdminComment = adminComment;

      await tenant.save();

      return res.status(200).json({
        success: true,
        data: tenant
      });

    } else {
      // Handle regular KYC submission verification
      const kyc = await KYC.findById(req.params.id);

      if (!kyc) {
        return res.status(404).json({
          success: false,
          message: 'KYC submission not found'
        });
      }

      kyc.status = status;
      kyc.adminComment = adminComment;
      kyc.verifiedAt = Date.now();
      kyc.verifiedBy = req.admin._id;

      await kyc.save();

      // Update user's KYC status in their respective model
      const UserModel = kyc.user.type === 'Agent' ? require('../../models/Agent') : require('../../models/Tenant');
      await UserModel.findByIdAndUpdate(kyc.user.id, {
        kycStatus: status,
        kycVerifiedAt: Date.now()
      });

      return res.status(200).json({
        success: true,
        data: kyc
      });
    }
  } catch (error) {
    console.error('Error verifying KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying KYC submission',
      error: error.message
    });
  }
});

module.exports = router; 