const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET;
const router = express.Router();
const Landlord = require('../../models/Landlord'); // Adjust the path as needed
const { authMiddleware } = require('../../middleware');
const sendEmail = require('../../utils/sendEmail'); // You'll need to implement this
const multer = require('multer');
const Agent = require('../../models/Agent');
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

// Landlord Signup
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, phoneNumber, dateOfBirth, unitOfProperty, amountSubscription, transferAccount, agentEmail  } = req.body;

    // Check if user already exists
    const existingLandlord = await Landlord.findOne({ 'email': email });
    if (existingLandlord) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    // Create new landlord
    const newLandlord = new Landlord({
      firstName: firstName,
      lastName: lastName,
      dateOfBirth: dateOfBirth,
      email: email,
      phoneNumber: phoneNumber,
      password: password,
      amountofunit: unitOfProperty,
      amountpaid: amountSubscription,
      agentreferral: agentEmail,
      transferAccount: transferAccount,
    });



    await newLandlord.save();

    res.status(201).json({
      message: 'Landlord registered successfully',
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Error registering landlord', error: error.message });
  }
});

// Landlord Signin
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find the landlord by email
    const landlord = await Landlord.findOne({ 'email': email });
    if (!landlord) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, landlord.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if agent is approved
    if (landlord.isApproved === false) {
     
      return res.status(403).json({ 
        success: false, 
        message: 'Account is pending approval. Please contact administration.' 
      });
    }

    // Create JWT token
    const token = jwt.sign({ id: landlord._id, role: 'landlord' }, jwtSecret, { expiresIn: '1d' });

    res.status(200).json({
      message: 'Signin successful',
      token,
      landlord: {
        id: landlord._id,
        firstName: landlord.firstName,
        lastName: landlord.lastName,
        email: landlord.email
      }
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ message: 'Error signing in', error: error.message });
  }
});

// Request an account officer assignment
router.post('/request-account-officer', authMiddleware, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlord._id);

    if (!landlord) {
      return res.status(404).json({ 
        success: false,
        message: 'Landlord not found' 
      });
    }

    // Check if landlord already has an account officer
    const hasAccountOfficer = landlord.accountOfficer && 
      Object.keys(landlord.accountOfficer).length > 0 && 
      landlord.accountOfficer.name;

    if (hasAccountOfficer) {
      return res.status(400).json({
        success: false,
        message: 'You already have an assigned account officer'
      });
    }

    // Check if there's already a pending request
    if (landlord.accountOfficerRequest?.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending account officer request'
      });
    }

    // Create new request
    landlord.accountOfficerRequest = {
      status: 'pending',
      requestedAt: new Date()
    };

    // Notify admins about the new request
    const emailContent = {
      subject: 'New Account Officer Assignment Request',
      message: `A new account officer assignment request has been submitted.
        
        Landlord Details:
        Name: ${landlord.firstName} ${landlord.lastName}
        Email: ${landlord.email}
        
        Please review this request in the admin dashboard.`,
        
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #444;">New Account Officer Assignment Request</h2>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #444; margin-top: 0;">Landlord Details:</h3>
                <p style="margin: 0;">
                  <strong>Name:</strong> ${landlord.firstName} ${landlord.lastName}<br>
                  <strong>Email:</strong> ${landlord.email}
                </p>
              </div>
              
              <p>Please review this request in the admin dashboard.</p>
            </div>
          </body>
        </html>
      `
    };

    await Promise.all([
      landlord.save(),
      sendEmail({
        email: process.env.ADMIN_EMAIL, // Make sure to set this in your .env
        subject: emailContent.subject,
        message: emailContent.message,
        html: emailContent.html
      })
    ]);

    res.status(200).json({
      success: true,
      message: 'Account officer request submitted successfully',
      requestStatus: 'pending'
    });

  } catch (error) {
    console.error('Request account officer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting account officer request',
      error: error.message
    });
  }
});

// Get account officer information and request status
router.get('/account-officer', authMiddleware, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlord._id);

    if (!landlord) {
      return res.status(404).json({
        success: false,
        message: 'Landlord not found'
      });
    }

    res.status(200).json({
      success: true,
      accountOfficer: landlord.accountOfficer || null,
      requestStatus: landlord.accountOfficerRequest?.status || 'none'
    });

  } catch (error) {
    console.error('Get account officer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching account officer information',
      error: error.message
    });
  }
});

// Delete account officer
router.delete('/delete-account-officer', authMiddleware, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlord._id);
    if (!landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    landlord.accountOfficer = null;
    await landlord.save();

    res.status(200).json({ message: 'Account officer deleted successfully' });
  } catch (error) {
    console.error('Delete account officer error:', error);
    res.status(500).json({ message: 'Error deleting account officer', error: error.message });
  }
});

// Fetch landlord profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlord._id).select('-password');
    
    if (!landlord) {

      return res.status(404).json({ message: 'Landlord not found' });
    }

    res.status(200).json(landlord);

  } catch (error) {
    console.log('Fetch profile error:', error);
    res.status(500).json({ message: 'Error fetching landlord profile', error: error.message });
  }
});

// Update landlord profile
router.put('/profile', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    // Extract personal info
    const {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      nationality,
      stateOfOrigin,
      localGovernmentArea,
    } = req.body.personalInfo || {};

    // Extract contact info 
    const {
      phoneNumber,
      alternatePhoneNumber,
      address,
    } = req.body.contactInfo || {};

    // Extract preferences
    const { preferences } = req.body;

    const landlord = await Landlord.findById(req.landlord._id);

    if (!landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    // Update avatar if a new file is uploaded
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      landlord.avatar = result.secure_url;
    }

    // Update personal info fields
    if (firstName) landlord.firstName = firstName;
    if (lastName) landlord.lastName = lastName;
    if (dateOfBirth) landlord.dateOfBirth = dateOfBirth;
    if (gender) landlord.gender = gender;
    if (nationality) landlord.nationality = nationality;
    if (stateOfOrigin) landlord.stateOfOrigin = stateOfOrigin;
    if (localGovernmentArea) landlord.localGovernmentArea = localGovernmentArea;

    // Update contact info fields
    if (phoneNumber) landlord.phoneNumber = phoneNumber;
    if (alternatePhoneNumber) landlord.alternatePhoneNumber = alternatePhoneNumber;
    if (address) landlord.address = address;

    // Update preferences
    if (preferences) {
      landlord.preferences = {
        ...landlord.preferences,
        ...preferences
      };
    }

    await landlord.save();

    // Return updated landlord without password
    const updatedLandlord = landlord.toObject();
    delete updatedLandlord.password;

    res.status(200).json({ 
      message: 'Profile updated successfully', 
      profile: updatedLandlord 
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Error updating landlord profile', error: error.message });
  }
});

// Change password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const landlord = await Landlord.findById(req.landlord._id);

    if (!landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, landlord.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    landlord.password = await bcrypt.hash(newPassword, salt);

    await landlord.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Error changing password', error: error.message });
  }
});

// Request a new account officer (when one is already assigned)
router.post('/request-new-account-officer', authMiddleware, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.landlord._id);

  

    if (!landlord) {
      return res.status(404).json({ 
        success: false,
        message: 'Landlord not found' 
      });
    }

    // Check if landlord has no current account officer
    if (!landlord.accountOfficer || Object.keys(landlord.accountOfficer).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'You currently have no account officer assigned. Please use the regular request endpoint.'
      });
    }

    // Check if there's already a pending request
    if (landlord.accountOfficerRequest?.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending account officer request'
      });
    }

    // Store current account officer details for reference
    const currentOfficer = {
      name: landlord.accountOfficer.name,
      email: landlord.accountOfficer.email,
      phonenumber: landlord.accountOfficer.phoneNumber

    };

    // Create new request with additional context
    landlord.accountOfficerRequest = {
      status: 'pending',
      requestedAt: new Date(),
    };

    // Notify admins about the replacement request
    const emailContent = {
      subject: 'Account Officer Replacement Request',
      message: `A landlord has requested a new account officer.
        
        Landlord Details:
        Name: ${landlord.firstName} ${landlord.lastName}
        Email: ${landlord.email}
        
        Current Account Officer:
        Name: ${currentOfficer.name}
        Email: ${currentOfficer.email}
        
        Please review this replacement request in the admin dashboard.`,
        
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #444;">Account Officer Replacement Request</h2>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #444; margin-top: 0;">Landlord Details:</h3>
                <p style="margin: 0;">
                  <strong>Name:</strong> ${landlord.firstName} ${landlord.lastName}<br>
                  <strong>Email:</strong> ${landlord.email}
                </p>
              </div>
              
              <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3 style="color: #856404; margin-top: 0;">Current Account Officer:</h3>
                <p style="margin: 0;">
                  <strong>Name:</strong> ${currentOfficer.name}<br>
                  <strong>Email:</strong> ${currentOfficer.email}
                </p>
              </div>
              
              <p>Please review this replacement request in the admin dashboard.</p>
            </div>
          </body>
        </html>
      `
    };

    await Promise.all([
      landlord.save(),
      sendEmail({
        email: process.env.ADMIN_EMAIL,
        subject: emailContent.subject,
        message: emailContent.message,
        html: emailContent.html
      })
    ]);

    // Also notify the current account officer
    await sendEmail({
      email: currentOfficer.email,
      subject: 'Account Officer Replacement Request Notification',
      message: `A replacement request has been submitted by ${landlord.firstName} ${landlord.lastName}. 
        The admin team will review this request and make necessary arrangements.`,
      html: `
        <!DOCTYPE html>
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #444;">Account Officer Replacement Request</h2>
              <p>A replacement request has been submitted by ${landlord.firstName} ${landlord.lastName}.</p>
              <p>The admin team will review this request and make necessary arrangements.</p>
            </div>
          </body>
        </html>
      `
    });

    res.status(200).json({
      success: true,
      message: 'New account officer request submitted successfully',
      requestStatus: 'pending'
    });

  } catch (error) {
    console.log('Request new account officer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting new account officer request',
      error: error.message
    });
  }
});

// Route to get KYC status
router.get('/kyc-status', authMiddleware, async (req, res) => {
  try {
    // Assuming you have middleware to get the logged-in user's ID
    const landlord = await Landlord.findById(req.landlord._id).select('-password');


    if (!landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }

    return res.status(200).json({ kycStatus: landlord.kycStatus });
    
  } catch (error) {
    console.log('Error fetching KYC status:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;