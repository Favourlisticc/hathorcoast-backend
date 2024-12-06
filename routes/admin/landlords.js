const express = require('express');
const router = express.Router();
const Landlord = require('../../models/Landlord');
const Property = require('../../models/Property');
const Agent = require('../../models/Agent');
const { adminMiddleware } = require('../../middleware');
const sendEmail = require('../../utils/sendEmail');

// Create a new landlord
router.post('/create', adminMiddleware, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      dateOfBirth,
      phoneNumber,
      email,
      password
    } = req.body;

    // Check if a landlord with the same email already exists
    const existingLandlord = await Landlord.findOne({ email });
    if (existingLandlord) {
      return res.status(400).json({ message: 'A landlord with this email already exists' });
    }

    // Create a new landlord instance
    const newLandlord = new Landlord({
      firstName,
      lastName,
      dateOfBirth,
      phoneNumber,
      email,
      password,
      isApproved: true
    });

    // Save the new landlord
    await newLandlord.save();

    // Return the created landlord without the password
    const landlordResponse = newLandlord.toObject();
    delete landlordResponse.password;

    res.status(201).json({
      success: true,
      message: 'Landlord created successfully',
      data: landlordResponse
    });
  } catch (error) {
    console.error('Error creating landlord:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating landlord',
      error: error.message
    });
  }
});

// Get all landlords
router.get('/landlords', adminMiddleware, async (req, res) => {
  try {
    const landlordDeets = await Landlord.find().select('-password');
    const landlords = await Promise.all(landlordDeets.map(async (landlord) => {
      const propertyCount = await Property.countDocuments({ landlord: landlord._id });
      return {
        ...landlord.toObject(),
        propertyCount
      };
    }));
    res.json(landlords);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching landlords', error: error.message });
  }
});

// Get all account officer requests
router.get('/account-officer-requests', adminMiddleware, async (req, res) => {
  try {
    const landlords = await Landlord.find({
      'accountOfficerRequest.status': { $exists: true }
    }).select('firstName lastName email accountOfficerRequest');

    const requests = landlords.map(landlord => ({
      _id: landlord._id,
      landlordId: landlord._id,
      landlordName: `${landlord.firstName} ${landlord.lastName}`,
      landlordEmail: landlord.email,
      requestedAt: landlord.accountOfficerRequest.requestedAt,
      status: landlord.accountOfficerRequest.status,
      processedAt: landlord.accountOfficerRequest.processedAt,
      processedBy: landlord.accountOfficerRequest.processedBy
    }));

    res.status(200).json({
      success: true,
      requests
    });

  } catch (error) {
    console.error('Fetch account officer requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching account officer requests',
      error: error.message
    });
  }
});

// Assign account officer to a landlord
router.post('/process-account-officer-request', adminMiddleware, async (req, res) => {
  try {
    const { landlordId, agentId, status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status provided'
      });
    }

    const [landlord, agent] = await Promise.all([
      Landlord.findById(landlordId),
      status === 'approved' ? Agent.findById(agentId) : null
    ]);

    if (!landlord) {
      return res.status(404).json({
        success: false,
        message: 'Landlord not found'
      });
    }

    if (status === 'approved') {
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Agent not found'
        });
      }

      // Update the landlord's account officer
      landlord.accountOfficer = {
        name: `${agent.firstName} ${agent.lastName}`,
        email: agent.email,
        phone: agent.phoneNumber,
        photo: agent.avatar
      };

      // Set the agent as the landlord's referrer
      landlord.referral.referredBy = agent._id;
      landlord.referral.referrerType = 'Agent';

      // Calculate commission based on your business logic
      const commissionAmount = 0; // Replace with your commission calculation

      // Add referral history entry for the landlord
      landlord.referral.commission.referralHistory.push({
        referredUser: agent._id,
        userType: 'Agent',
        commission: commissionAmount,
        date: new Date(),
        status: 'completed'
      });

      // Add referral history entry for the agent
      agent.referral.commission.referralHistory.push({
        referredUser: landlord._id,
        userType: 'Landlord',
        commission: commissionAmount,
        date: new Date(),
        status: 'completed'
      });

      // Update agent's commission balance and total earned
      agent.referral.commission.balance += commissionAmount;
      agent.referral.commission.totalEarned += commissionAmount;

      // Update request status
      landlord.accountOfficerRequest = {
        status: 'approved',
        processedAt: new Date(),
        processedBy: req.admin._id
      };

      // Send email notifications
      const emailPromises = [
        // Email to Agent
        sendEmail({
          email: agent.email,
          subject: 'New Landlord Assignment Confirmation',
          html: `
            <!DOCTYPE html>
            <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #444;">New Landlord Assignment</h2>
                  
                  <p>Hello ${agent.firstName},</p>
                  
                  <p>Your account officer request has been approved. You are now assigned as both the account officer and referrer for:</p>
                  
                  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 0;">
                      <strong>Landlord Name:</strong> ${landlord.firstName} ${landlord.lastName}<br>
                      <strong>Email:</strong> ${landlord.email}
                    </p>
                  </div>
                  
                  <p>A commission of ₦${commissionAmount.toLocaleString()} has been added to your account.</p>
                  
                  <p>Please reach out to the landlord to introduce yourself and begin managing their account.</p>
                  
                  <p>Best regards,<br>Property Management Team</p>
                </div>
              </body>
            </html>
          `
        }),
        // Email to Landlord
        sendEmail({
          email: landlord.email,
          subject: 'Account Officer Assignment Confirmation',
          html: `
            <!DOCTYPE html>
            <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #444;">Account Officer Assigned</h2>
                  
                  <p>Hello ${landlord.firstName},</p>
                  
                  <p>Your account officer request has been approved. We're pleased to inform you that an account officer has been assigned to your account:</p>
                  
                  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 0;">
                      <strong>Account Officer:</strong> ${agent.firstName} ${agent.lastName}<br>
                      <strong>Email:</strong> ${agent.email}<br>
                      <strong>Phone:</strong> ${agent.phoneNumber}
                    </p>
                  </div>
                  
                  <p>Your account officer will be in touch with you shortly to introduce themselves and assist you with your property management needs.</p>
                  
                  <p>Best regards,<br>Property Management Team</p>
                </div>
              </body>
            </html>
          `
        })
      ];

      // Save all updates
      await Promise.all([
        landlord.save(),
        agent.save(),
        ...emailPromises
      ]);
    } else {
      // Handle rejection
      landlord.accountOfficerRequest = {
        status: 'rejected',
        processedAt: new Date(),
        processedBy: req.admin._id
      };

      await Promise.all([
        landlord.save(),
        sendEmail({
          email: landlord.email,
          subject: 'Account Officer Request Update',
          html: `
            <!DOCTYPE html>
            <html>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #444;">Account Officer Request Update</h2>
                  
                  <p>Hello ${landlord.firstName},</p>
                  
                  <p>We regret to inform you that your account officer request could not be processed at this time. Please contact our support team if you have any questions.</p>
                  
                  <p>Best regards,<br>Property Management Team</p>
                </div>
              </body>
            </html>
          `
        })
      ]);
    }

    res.status(200).json({
      success: true,
      message: `Account officer request ${status}`,
      accountOfficer: landlord.accountOfficer
    });

  } catch (error) {
    console.error('Process account officer request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing account officer request',
      error: error.message
    });
  }
});

// Get a single landlord
router.get('/:id', adminMiddleware, async (req, res) => {
  try {
    const landlord = await Landlord.findById(req.params.id).select('-password');
    if (!landlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }
    res.json(landlord);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching landlord', error: error.message });
  }
});

// Update a landlord
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const updatedLandlord = await Landlord.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
    if (!updatedLandlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }
    res.json(updatedLandlord);
  } catch (error) {
    res.status(500).json({ message: 'Error updating landlord', error: error.message });
  }
});

// Delete a landlord
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const deletedLandlord = await Landlord.findByIdAndDelete(req.params.id);
    if (!deletedLandlord) {
      return res.status(404).json({ message: 'Landlord not found' });
    }
    res.json({ message: 'Landlord deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting landlord', error: error.message });
  }
});

module.exports = router;
