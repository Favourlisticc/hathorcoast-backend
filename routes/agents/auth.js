const express = require('express');
const router = express.Router();
const Agent = require('../../models/Agent');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Landlord = require('../../models/Landlord');
const Tenant = require('../../models/Tenant');
const Property = require('../../models/Property');
const Utility = require('../../models/Utility');
const Eviction = require('../../models/Eviction');
const Conversation = require('../../models/Conversation');
const Message = require('../../models/Message');
const Commission = require('../../models/Commission');
const CommissionConfig = require('../../models/CommissionConfig');
const NotificationService = require('../../services/NotificationService');
const { calculateCommission } = require('../../services/commissionService');
const sendEmail = require('../../utils/sendEmail');

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
      console.log( 'Not authorized')
    //   res.status(401).json({ success: false, message: 'Not authorized' });
    }
  }

  if (!token) {
    console.log( 'Not authorized, no token' )
    // res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};

// @desc    Register new agent
// @route   POST /api/agents/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, email, password, businessName } = req.body;

    // Check if agent exists
    const agentExists = await Agent.findOne({ email });
    if (agentExists) {
      return res.status(400).json({ success: false, message: 'Agent already exists' });
    }

    // Create agent
    const agent = await Agent.create({
      firstName,
      lastName,
      phoneNumber,
      email,
      password,
      businessName
    });

    if (agent) {
      res.status(201).json({
        success: true,
        data: {
          _id: agent._id,
          firstName: agent.firstName,
          lastName: agent.lastName,
          email: agent.email,
          phoneNumber: agent.phoneNumber,
          businessName: agent.businessName,
          token: generateToken(agent._id, 'agent')
        }
      });
    }
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Authenticate agent
// @route   POST /api/agents/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

   

    // Check for agent email - explicitly select password field
    const agent = await Agent.findOne({ email }).select('+password');
    if (!agent) {
      console.log("Invalid Credentials")
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check if agent is approved
    if (agent.isApproved === false) {
      
      return res.status(403).json({ 
        success: false, 
        message: 'Account is pending approval. Please contact administration.' 
      });
    }

    // Check password
    const isMatch = await agent.matchPassword(password);
    if (!isMatch) {
      console.log("Invalid Credentials")
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const token = jwt.sign({ id: agent._id, role: 'agent' }, process.env.JWT_SECRET, { expiresIn: '1d' });


    res.status(200).json({
      success: true,
      token,
      data: {
        _id: agent._id,
        firstName: agent.firstName,
        lastName: agent.lastName,
        email: agent.email,
        phoneNumber: agent.phoneNumber,
        businessName: agent.businessName,
      }
    });

   
  } catch (error) {
    console.log(error)
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// @desc    Get agent profile
// @route   GET /api/agents/profile/:id
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const agent = await Agent.findById(req.agent._id).select('-password');
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }
    res.status(200).json({ success: true, data: agent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Get all agents
// @route   GET /api/agents
// @access  Private
router.get('/all', async (req, res) => {
  try {
    const agents = await Agent.find({}).select('-password');
    res.status(200).json({ success: true, data: agents });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Update agent profile
// @route   PUT /api/agents/profile/:id
// @access  Private
router.put('/profile/:id', protect, async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    // Ensure agent can only update their own profile
    if (agent._id.toString() !== req.agent._id.toString()) {
      return res.status(401).json({ success: false, message: 'Not authorized to update this profile' });
    }

    const updatedAgent = await Agent.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({ success: true, data: updatedAgent });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Delete agent
// @route   DELETE /api/agents/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    // Ensure agent can only delete their own profile
    if (agent._id.toString() !== req.agent._id.toString()) {
      return res.status(401).json({ success: false, message: 'Not authorized to delete this profile' });
    }

    await agent.deleteOne();
    res.status(200).json({ success: true, message: 'Agent deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Get all landlords
// @route   GET /api/agents/landlords
// @access  Private
router.get('/landlords', protect, async (req, res) => {
  try {
    // Fetch the agent's email from the database
    const agent = await Agent.findById(req.agent._id).select('-password');
 
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    // Find landlords where agentReferral matches the agent's email
    const landlords = await Landlord.find({ agentreferral: agent.email }).select('-password');
   

    // Send the filtered landlords to the frontend
    res.status(200).json({ success: true, data: landlords });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});


// @desc    Create landlord
// @route   POST /api/agents/landlords
// @access  Private 
router.post('/landlords', protect, async (req, res) => {
  try {
    const landlord = await Landlord.create(req.body);

    res.status(201).json({ success: true, data: landlord });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Update landlord
// @route   PUT /api/agents/landlords/:id
// @access  Private
router.put('/landlords/:id', protect, async (req, res) => {
  try {
    const landlord = await Landlord.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).select('-password');

    if (!landlord) {
      return res.status(404).json({ success: false, message: 'Landlord not found' });
    }

    res.status(200).json({ success: true, data: landlord });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Get all tenants
// @route   GET /api/agents/tenants
// @access  Private
router.get('/tenants', protect, async (req, res) => {
  try {
    // Find the agent by ID
    const agent = await Agent.findById(req.agent._id).select('-password');
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    // Find landlords where agentReferral matches the agent's email
    const landlords = await Landlord.find({ agentreferral: agent.email }).select('tenants');

    // Extract tenant IDs from landlords
    const tenantIds = landlords.flatMap(landlord => landlord.tenants);

  

    // Find tenants using the extracted tenant IDs
    const tenants = await Tenant.find({ _id: { $in: tenantIds } }).select('-password');

    res.status(200).json({ success: true, data: tenants });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});


// @desc    Create tenant
// @route   POST /api/agents/tenants
// @access  Private
router.post('/tenants', protect, async (req, res) => {
  try {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create a new tenant instance using the request body
      const tenant = new Tenant({
        title: req.body.title,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        dateOfBirth: new Date(req.body.dob),
        contactInfo: {
          email: req.body.email,
          phoneNumber: req.body.phone,
        },
        password: req.body.password,
        currentAddress: req.body.currentAddress,
        nextOfKin: {
          name: req.body.nextOfKinName,
          phoneNumber: req.body.nextOfKinPhone,
          address: req.body.nextOfKinAddress,
        },
        employmentStatus: req.body.employmentStatus,
        establishmentName: req.body.establishmentName,
        employmentAddress: req.body.employmentAddress,
        landlord: req.body.landlordId,
        property: req.body.propertyId,
        unitsLeased: req.body.unitsLeased,
        leaseType: req.body.leaseType,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        apartmentName: req.body.apartmentName,
        rent: req.body.rent,
        cautionFee: req.body.cautionFee,
        paymentMode: req.body.paymentMode,
        agent: req.agent._id
      });

      // Save the new tenant
      await tenant.save({ session });

      // Update the property status and currentTenant
      const property = await Property.findById(req.body.propertyId);
      
      if (!property) {
        throw new Error('Property not found');
      }

      // Calculate commission based on rent amount and payment mode
      const commissionAmount = await calculateCommission(
        req.body.rent,
        req.body.paymentMode
      );

      // Create rental history entry with commission
      property.rentalHistory.push({
        tenant: tenant._id,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        monthlyRent: req.body.rent,
        commission: {
          amount: commissionAmount,
          status: 'pending',
        }
      });

      // Update property status
      property.status = 'Occupied';
      property.currentTenant = tenant._id;
      property.agent = req.agent._id; // Associate agent with property

      await property.save({ session });

      // Update agent's commission balance
      const agent = await Agent.findById(req.agent._id);
      agent.commission.totalEarned += commissionAmount;
      agent.commission.balance += commissionAmount;
      await agent.save({ session });

      // Create commission record
      const commission = new Commission({
        agent: req.agent._id,
        property: property._id,
        tenant: tenant._id,
        amount: commissionAmount,
        type: 'rental',
        status: 'pending',
        details: {
          monthlyRent: req.body.rent,
          paymentMode: req.body.paymentMode,
          leaseStartDate: req.body.startDate,
          leaseEndDate: req.body.endDate
        }
      });

      await commission.save({ session });

      await session.commitTransaction();

      await sendEmail({
        email: tenant.contactInfo.email,
        subject: 'Welcome to Hatenant - Your New Home Awaits!',
        message: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Welcome to Hatenant!</h2>
            
            <p>Dear ${tenant.title} ${tenant.firstName} ${tenant.lastName},</p>

            <p>We're excited to welcome you to Hatenant! Your account has been successfully created and you've been assigned to your new property:</p>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Property:</strong> ${tenant.apartmentName}</p>
              <p style="margin: 5px 0;"><strong>Lease Start Date:</strong> ${new Date(tenant.startDate).toLocaleDateString()}</p>
              <p style="margin: 5px 0;"><strong>Lease End Date:</strong> ${new Date(tenant.endDate).toLocaleDateString()}</p>
            </div>

            <p>To access your account, please use the following credentials:</p>
            <ul style="list-style: none; padding-left: 0;">
              <li>Email: ${tenant.contactInfo.email}</li>
              <li>Password: ${req.body.password}</li>
            </ul>

            <p>Best regards,<br>The Hatenant Team</p>
          </div>
        `
      });
      
      res.status(201).json({
        success: true,
        data: {
          tenant,
          commission: {
            amount: commissionAmount,
            status: 'pending'
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
    res.status(400).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// @desc    Update tenant
// @route   PUT /api/agents/tenants/:id
// @access  Private
router.put('/tenants/:id', protect, async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).select('-password');

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    res.status(200).json({ success: true, data: tenant });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Get all properties
// @route   GET /api/agents/properties
// @access  Private
router.get('/properties', protect, async (req, res) => {
  try {
    // Find the agent by ID
    const agent = await Agent.findById(req.agent._id).select('-password');
    if (!agent) {
      return res.status(404).json({ success: false, message: "Agent not found" });
    }

    // Find landlords where agentReferral matches the agent's email
    const landlords = await Landlord.find({ agentReferral: agent.email }).select('properties');

    // Extract property IDs from landlords
    const propertyIds = landlords.flatMap(landlord => landlord.properties);

    // Find properties using the extracted property IDs
    const properties = await Property.find({ _id: { $in: propertyIds } }).populate('landlord', 'firstName lastName email');

    res.status(200).json({ success: true, data: properties });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});


// @desc    Create property
// @route   POST /api/agents/properties
// @access  Private
router.post('/properties', protect, async (req, res) => {
  try {
    // Add the agent as the property manager and set status if tenant exists
    const propertyData = {
      ...req.body,
      propertyManager: req.agent._id, // Add logged in agent as property manager
      status: req.body.currentTenant ? 'Occupied' : 'Available'
    };

    const property = await Property.create(propertyData);
    res.status(201).json({ success: true, data: property });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Update property
// @route   PUT /api/agents/properties/:id
// @access  Private
router.put('/properties/:id', protect, async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.status(200).json({ success: true, data: property });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Get all utilities
// @route   GET /api/agents/utilities
// @access  Private
router.get('/utilities', protect, async (req, res) => {
  try {
    const utilities = await Utility.find().sort({ name: 1 });
    res.status(200).json(utilities);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Create utility
// @route   POST /api/agents/utilities
// @access  Private
router.post('/utilities', protect, async (req, res) => {
  try {
    const { name } = req.body;

    // Check if utility already exists
    const utilityExists = await Utility.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (utilityExists) {
      return res.status(400).json({ success: false, message: 'Utility already exists' });
    }

    const utility = await Utility.create({ name });
    res.status(201).json({ success: true, data: utility });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Update utility
// @route   PUT /api/agents/utilities/:id
// @access  Private 
router.put('/utilities/:id', protect, async (req, res) => {
  try {
    const { name } = req.body;

    // Check if utility exists
    const utility = await Utility.findById(req.params.id);
    if (!utility) {
      return res.status(404).json({ success: false, message: 'Utility not found' });
    }

    // Check if new name already exists
    const nameExists = await Utility.findOne({ 
      _id: { $ne: req.params.id },
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });
    if (nameExists) {
      return res.status(400).json({ success: false, message: 'Utility name already exists' });
    }

    utility.name = name;
    await utility.save();

    res.status(200).json({ success: true, data: utility });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Delete utility
// @route   DELETE /api/agents/utilities/:id
// @access  Private
router.delete('/utilities/:id', protect, async (req, res) => {
  try {
    const utility = await Utility.findById(req.params.id);
    if (!utility) {
      return res.status(404).json({ success: false, message: 'Utility not found' });
    }

    await utility.deleteOne();
    res.status(200).json({ success: true, message: 'Utility deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Create eviction notice
// @route   POST /api/agents/evictions
// @access  Private
router.post('/evictions', protect, async (req, res) => {
  try {
    const { tenant, property, landlord, reason, noticeDate, scheduledEvictionDate, documents, notes, legalProceedings } = req.body;

    const eviction = await Eviction.create({
      tenant,
      property,
      landlord,
      reason,
      noticeDate,
      scheduledEvictionDate,
      documents,
      notes,
      legalProceedings
    });

    res.status(201).json({ success: true, data: eviction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Get all eviction notices
// @route   GET /api/agents/evictions
// @access  Private
router.get('/evictions', protect, async (req, res) => {
  try {
    const evictions = await Eviction.find()
      .populate('tenant', 'firstName lastName email phoneNumber')
      .populate('property', 'name address')
      .populate('landlord', 'firstName lastName email phoneNumber');

    res.status(200).json({ success: true, data: evictions });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Get single eviction notice
// @route   GET /api/agents/evictions/:id
// @access  Private
router.get('/evictions/:id', protect, async (req, res) => {
  try {
    const eviction = await Eviction.findById(req.params.id)
      .populate('tenant', 'firstName lastName email phoneNumber')
      .populate('property', 'name address')
      .populate('landlord', 'firstName lastName email phoneNumber');

    if (!eviction) {
      return res.status(404).json({ success: false, message: 'Eviction notice not found' });
    }

    res.status(200).json({ success: true, data: eviction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Update eviction notice
// @route   PUT /api/agents/evictions/:id
// @access  Private
router.put('/evictions/:id', protect, async (req, res) => {
  try {
    const eviction = await Eviction.findById(req.params.id);
    if (!eviction) {
      return res.status(404).json({ success: false, message: 'Eviction notice not found' });
    }

    const updatedEviction = await Eviction.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    ).populate('tenant property landlord');

    res.status(200).json({ success: true, data: updatedEviction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// @desc    Delete eviction notice
// @route   DELETE /api/agents/evictions/:id
// @access  Private
router.delete('/evictions/:id', protect, async (req, res) => {
  try {
    const eviction = await Eviction.findById(req.params.id);
    if (!eviction) {
      return res.status(404).json({ success: false, message: 'Eviction notice not found' });
    }

    await eviction.deleteOne();
    res.status(200).json({ success: true, message: 'Eviction notice deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Route to get KYC status
router.get('/kyc-status', protect, async (req, res) => {
  try {
    // Assuming you have middleware to get the logged-in user's ID
    const agent = await Agent.findById(req.agent._id).select('-password');


    if (!agent) {
      console.log('Landlord not found')
      return res.status(404).json({ message: 'Landlord not found' });
    }


    return res.status(200).json({ kycStatus: agent.kycStatus });
   
  } catch (error) {
    console.log('Error fetching KYC status:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
