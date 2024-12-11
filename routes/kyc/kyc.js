const express = require('express');
const router = express.Router();
const KYC = require('../../models/KYC');
const Tenant = require('../../models/Tenant');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { authMiddleware, adminMiddleware } = require('../../middleware');
const fs = require('fs');
const Agent = require('../../models/Agent')
const Landlord = require("../../models/Landlord")

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

    console.log('Received document types:', documentTypes);
    console.log('Received descriptions:', descriptions);
    console.log('Uploaded files:', files);

    // Check if KYC already exists
    console.log('Checking for existing pending KYC submission...');
    const existingKYC = await KYC.findOne({
      'user.id': req.agent._id,
      'user.type': 'Agent',
      status: 'PENDING',
    });

    if (existingKYC) {
      console.log('Pending KYC already exists:', existingKYC);
      return res.status(400).json({
        success: false,
        message: 'You already have a pending KYC verification',
      });
    }

    console.log('Uploading files to Cloudinary...');
    // Upload files to Cloudinary
    const uploadedDocuments = await Promise.all(
      files.map(async (file, index) => {
        try {
          console.log(`Uploading file: ${file.originalname}`);
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'kyc-documents',
            resource_type: 'auto',
          });

          console.log('Upload successful:', result.secure_url);

          // Delete local file after upload
          await fs.promises.unlink(file.path);
          console.log('Local file deleted:', file.path);

          return { 
            type: Array.isArray(documentTypes) ? documentTypes[index] : documentTypes, 
            documenturl: result.secure_url, 
            publicId: result.public_id, 
            description: descriptions ? descriptions[index] || '' : '', 
            selfieurl: documentTypes[index] === 'selfie' ? result.secure_url : undefined, };
        } catch (error) {
          console.error('Error uploading file to Cloudinary:', error);
          throw new Error(`Failed to upload file: ${file.originalname}`);
        }
      })
    );

    console.log('Agent Email:', req.agent.email);

    const agentExists = await Agent.findOne({ email: req.agent.email });

    console.log('Agent Email:', agentExists);

    if (!agentExists) {
        console.error('Agent not found.');
        return res.status(404).json({
            success: false,
            message: 'Agent not found',
        });
    }

    console.log('Agent found:', agentExists);

    // Update Agent's kycStatus using email
    const updatedAgent = await Agent.findOneAndUpdate(
        { email: req.agent.email },  // Correctly find the agent by email
        { kycStatus: 'PENDING' }, // Update the kycStatus field
        { new: true } // Return the updated document
    );

    if (!updatedAgent) {
        console.error('Failed to update Agent KYC status.');
        return res.status(404).json({
            success: false,
            message: 'Agent not found or failed to update KYC status',
        });
    }

    console.log('Agent KYC status updated successfully:', updatedAgent);
    // Save KYC record
    const kyc = new KYC({
      user: {
        id: req.agent._id,
        type: 'Agent',
      },
      documents: uploadedDocuments,
      status: 'PENDING',
    });

    await kyc.save();
    console.log('KYC record saved:', kyc);

    

    res.status(201).json({
      success: true,
      data: kyc,
    });
  } catch (error) {
    console.error('KYC submission error:', error);

    // Clean up local files in case of an error
    if (req.files) {
      console.log('Cleaning up local files...');
      await Promise.all(
        req.files.map(async (file) => {
          try {
            await fs.promises.unlink(file.path);
            console.log('Deleted local file:', file.path);
          } catch (err) {
            console.error('Error cleaning up file:', file.path, err);
          }
        })
      );
    }

    res.status(500).json({
      success: false,
      message: 'Error submitting KYC documents',
      error: error.message,
    });
  }
});



router.post('/Landlord/submit', authMiddleware, upload.array('documents', 2), async (req, res) => {
  try {
    const { documentTypes, descriptions } = req.body;
    const files = req.files;

    console.log('Received document types Landlords:', documentTypes);
    console.log('Received descriptions:', descriptions);
    console.log('Uploaded files:', files);

    // Check if KYC already exists
    console.log('Checking for existing pending KYC submission...');
    const existingKYC = await KYC.findOne({
      'user.id': req.landlord._id,
      'user.type': 'Landlord',
      status: 'PENDING',
    });

    if (existingKYC) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending KYC verification',
      });
    }

    console.log('Uploading files to Cloudinary...');
    // Upload files to Cloudinary
    const uploadedDocuments = await Promise.all(
      files.map(async (file, index) => {
        try {
          console.log(`Uploading file: ${file.originalname}`);
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'kyc-documents',
            resource_type: 'auto',
            timeout: 120000,
          });

          console.log('Upload successful:', result.secure_url);

          // Delete local file after upload
          await fs.promises.unlink(file.path);
          console.log('Local file deleted:', file.path);

          return { 
            type: Array.isArray(documentTypes) ? documentTypes[index] : documentTypes, 
            documenturl: result.secure_url, 
            publicId: result.public_id, 
            description: descriptions ? descriptions[index] || '' : '', 
            selfieurl: documentTypes[index] === 'selfie' ? result.secure_url : undefined, };
        } catch (error) {
          console.error('Error uploading file to Cloudinary:', error);
          throw new Error(`Failed to upload file: ${file.originalname}`);
        }
      })
    );

    console.log('landlord Email:', req.landlord.email);

    const landlordExists = await Landlord.findOne({ email: req.landlord.email });


    if (!landlordExists) {
        console.error('landlord not found.');
        return res.status(404).json({
            success: false,
            message: 'landlord not found',
        });
    }


    // Update landlord's kycStatus using email
    const updatedlandlord = await Landlord.findOneAndUpdate(
        { email: req.landlord.email },  // Correctly find the landlord by email
        { kycStatus: 'PENDING' }, // Update the kycStatus field
        { new: true } // Return the updated document
    );

    if (!updatedlandlord) {
        console.error('Failed to update landlord KYC status.');
        return res.status(404).json({
            success: false,
            message: 'landlord not found or failed to update KYC status',
        });
    }

    console.log('landlord KYC status updated successfully:', updatedlandlord);
    // Save KYC record
    const kyc = new KYC({
      user: {
        id: req.landlord._id,
        type: 'Landlord',
      },
      documents: uploadedDocuments,
      status: 'PENDING',
    });

    await kyc.save();
    console.log('KYC record saved:', kyc);

    

    res.status(201).json({
      success: true,
      data: kyc,
    });
  } catch (error) {
    console.error('KYC submission error:', error);

    // Clean up local files in case of an error
    if (req.files) {
      console.log('Cleaning up local files...');
      await Promise.all(
        req.files.map(async (file) => {
          try {
            await fs.promises.unlink(file.path);
            console.log('Deleted local file:', file.path);
          } catch (err) {
            console.error('Error cleaning up file:', file.path, err);
          }
        })
      );
    }

    res.status(500).json({
      success: false,
      message: 'Error submitting KYC documents',
      error: error.message,
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
      .select('firstName lastName address phoneNumber contactInfo.email kycDocuments kycStatus kycVerifiedAt')
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
          address: sub.user.id.address,
          phonenumber: sub.user.id.phoneNumber,
          email: sub.user.id.contactInfo?.email || sub.user.id.email,
          type: sub.user.type,
        },
        documents: sub.documents.map(doc => doc.documenturl), // Extract all document URLs
        documentsDescription: sub.documents.map(doc => doc.description), // Extract all document URLs
        documentsType: sub.documents.map(doc => doc.type), // Extract all document URLs
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
          type: 'Tenant',
        },
        documents: {
          passport: tenant.kycDocuments.passport,
          identityProof: tenant.kycDocuments.identityProof,
          identityProofType: tenant.kycDocuments.identityProofType,
        },
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

router.put('/admin/verify/:id', adminMiddleware, async (req, res) => {
  try {
    const { status, adminComment, submissionType } = req.body;

    console.log(status, adminComment, submissionType)

    // Handle verification based on user type
    let UserModel;
    if (submissionType === 'Agent') {
      UserModel = require('../../models/Agent');
    } else if (submissionType === 'Tenant') {
      UserModel = require('../../models/Tenant');
    } else if (submissionType === 'Landlord') {
      UserModel = require('../../models/Landlord');
    } else {
      console.log('Invalid user type')
      return res.status(400).json({
        success: false,
        message: 'Invalid user type',
      });
    }

    // Find user and update KYC
    const user = await UserModel.findById(req.params.id);
    if (!user) {
      console.log(`${submissionType} not found`)
      return res.status(404).json({
        success: false,
        message: `${submissionType} not found`,
      });
    }

    user.kycStatus = status; // Update KYC status
    user.kycVerifiedAt = Date.now(); // Add verification timestamp
    user.kycVerifiedBy = req.admin._id; // Record admin ID
    user.kycAdminComment = adminComment; // Add admin comment
    await user.save();

    // Update KYC schema for the submitted ID
    const kyc = await KYC.findOneAndUpdate(
      { 'user.id': req.params.id, 'user.type': submissionType },
      { status, verifiedAt: Date.now(), verifiedBy: req.admin._id, adminComment },
      { new: true }
    );

    if (!kyc) {
      console.log("KYC submission not found")
      return res.status(404).json({
        success: false,
        message: 'KYC submission not found',
      });
    }

    console.log(kyc)
    return res.status(200).json({
      success: true,
      data: kyc,
    });
  } catch (error) {
    console.log('Error verifying KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying KYC submission',
      error: error.message,
    });
  }
});


module.exports = router; 