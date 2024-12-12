const express = require('express');
const router = express.Router();
const Agent = require('../../models/Agent');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' });

router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));

// Helper function to generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id, role: 'agent' }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Middleware to protect routes
const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.agent = await Agent.findById(decoded.id).select('-password');
      next();
    } catch (error) {
      res.status(401).json({ success: false, message: 'Not authorized' });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

// Fetch agent profile
router.get('/profile', protect, async (req, res) => {
  try {
    const agent = await Agent.findById(req.agent._id).select('-password');
    
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        message: 'Agent not found' 
      });
    }

    res.status(200).json({
      success: true,
      data: agent
    });
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching agent profile', 
      error: error.message 
    });
  }
});

// Update agent profile
router.put('/profile', protect, upload.single('avatar'), async (req, res) => {
  try {
    const {
      personalInfo,
      contactInfo,
      bankDetails,
      nextOfKin
    } = req.body;

    const agent = await Agent.findById(req.agent._id);

    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        message: 'Agent not found' 
      });
    }

    
    // Update avatar if a new file is uploaded
    if (req.file) {
      // Delete old avatar from Cloudinary if exists
      if (agent.avatar) {
        const publicId = agent.avatar.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(publicId);
      }
      const result = await cloudinary.uploader.upload(req.file.path);
      agent.avatar = result.secure_url;
    }

    // Update personal info
    if (personalInfo) {
      const {
        firstName,
        lastName,
        dateOfBirth,
        gender,
        nationality,
        stateOfOrigin,
        localGovernmentArea,
        businessName
      } = personalInfo;

      if (firstName) agent.firstName = firstName;
      if (lastName) agent.lastName = lastName;
      if (dateOfBirth) agent.dateOfBirth = dateOfBirth;
      if (gender) agent.gender = gender;
      if (nationality) agent.nationality = nationality;
      if (stateOfOrigin) agent.stateOfOrigin = stateOfOrigin;
      if (localGovernmentArea) agent.localGovernmentArea = localGovernmentArea;
      if (businessName) agent.businessName = businessName;
    }

    // Update contact info
    if (contactInfo) {
      const {
        phoneNumber,
        alternativePhone,
        alternativeEmail,
        address
      } = contactInfo;

      if (phoneNumber) agent.phoneNumber = phoneNumber;
      if (alternativePhone) agent.alternativePhone = alternativePhone;
      if (alternativeEmail) agent.alternativeEmail = alternativeEmail;
      if (address) agent.address = address;
    }

    // Update bank details
    if (bankDetails) {
      agent.bankDetails = {
        ...agent.bankDetails,
        ...bankDetails
      };
    }

    // Update next of kin
    if (nextOfKin) {
      agent.nextOfKin = {
        ...agent.nextOfKin,
        ...nextOfKin
      };
    }

    await agent.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: agent
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating agent profile',
      error: error.message
    });
  }
});

// Update documents
router.put('/profile/documents', protect, 
  upload.fields([
    { name: 'passport', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
    { name: 'identificationDoc', maxCount: 1 }
  ]), 
  async (req, res) => {
    try {
      const agent = await Agent.findById(req.agent._id);

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Agent not found'
        });
      }

      const files = req.files;
      const documents = {};

      // Process each document type
      for (const [key, fileArray] of Object.entries(files)) {
        const file = fileArray[0];
        // Delete old document if exists
        if (agent.documents[key]) {
          const publicId = agent.documents[key].split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(publicId);
        }
        // Upload new document
        const result = await cloudinary.uploader.upload(file.path, {
          folder: `agents/documents/${key}`
        });
        documents[key] = result.secure_url;
      }

      agent.documents = {
        ...agent.documents,
        ...documents
      };

      await agent.save();

      res.status(200).json({
        success: true,
        message: 'Documents updated successfully',
        data: agent
      });
    } catch (error) {
      console.error('Update documents error:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating documents',
        error: error.message
      });
    }
});


// Fetch commission balance and referrals
router.get('/agent-data', protect, async (req, res) => {
  try {
    const agentId = req.agent._id; // Assuming authMiddleware attaches user info to req

    // Fetch agent data
    const agent = await Agent.findById(agentId)
      .select('commission referrals') // Only fetch commission and referral fields
      .populate({
        path: 'referral.referredBy',
        select: 'useremail phonenumber amountpaid', // Adjust based on your schema
      });

    if (!agent) {
      return res.status(404).json({ message: 'Agent not found' });
    }

    console.log(agent.commission, agent.referrals)
    res.json({
      commission: agent.commission,
      referrals: agent.referrals,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router; 