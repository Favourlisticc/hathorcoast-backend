const jwt = require('jsonwebtoken');
const Landlord = require('./models/Landlord'); // Adjust path as needed
const Tenant = require('./models/Tenant');
const Agent = require('./models/Agent'); // Add this import
const Admin = require('./models/Admin'); // Make sure to create this model
const TokenBlacklist = require('./models/TokenBlacklist');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No authentication token, access denied' 
      });
    }

    // Check if token is blacklisted
    const isBlacklisted = await TokenBlacklist.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({ 
        success: false,
        message: 'Token has been revoked',
        reason: isBlacklisted.reason
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'agent') {
      const agent = await Agent.findOne({ _id: decoded.id });
      if (!agent) {
        throw new Error('Agent not found');
      }
      if (agent.status === 'suspended') {
        return res.status(403).json({
          success: false,
          message: 'Account suspended',
          suspensionDetails: agent.suspensionDetails
        });
      }
      req.agent = agent;
    } else if (decoded.role === 'landlord') {
      const landlord = await Landlord.findOne({ _id: decoded.id });
      if (!landlord) {
        throw new Error('Landlord not found');
      }
      if (landlord.status === 'suspended') {
        return res.status(403).json({
          success: false,
          message: 'Account suspended',
          suspensionDetails: landlord.suspensionDetails
        });
      }
      req.landlord = landlord;
    } else if (decoded.role === 'tenant') {
      const tenant = await Tenant.findOne({ _id: decoded.id });
      if (!tenant) {
        throw new Error('Tenant not found');
      }
      
      // Check if tenant is suspended
      if (tenant.status === 'suspended') {
        // Blacklist the current token
        await TokenBlacklist.create({
          token,
          userId: tenant._id,
          reason: 'Account suspended',
          expiresAt: new Date(decoded.exp * 1000)
        });

        return res.status(403).json({
          success: false,
          message: 'Account suspended',
          suspensionDetails: {
            reason: tenant.suspensionDetails?.reason,
            suspendedAt: tenant.suspensionDetails?.suspendedAt
          }
        });
      }
      
      req.tenant = tenant;
    } else if (decoded.role === 'admin') {
      const admin = await Admin.findOne({ _id: decoded.id });
      if (!admin) {
        throw new Error('Admin not found');
      }
      if (admin.status === 'suspended' && admin.role !== 'superadmin') {
        return res.status(403).json({
          success: false,
          message: 'Account suspended',
          suspensionDetails: admin.suspensionDetails
        });
      }
      req.admin = admin;
    }

    // Store the decoded token info for easy access
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ 
      success: false,
      message: error.message || 'Token is not valid' 
    });
  }
};

const adminMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No authentication token, access denied' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === 'admin') {
      const admin = await Admin.findOne({ _id: decoded.id });
      if (!admin) {
        return res.status(404).json({ 
          success: false,
          message: 'Admin not found' 
        });
      }
      if (!admin.isActive) {
        return res.status(403).json({ 
          success: false,
          message: 'Admin account is inactive' 
        });
      }
      req.admin = admin;
    } else if (decoded.role === 'superadmin') {
      const superAdmin = await Admin.findOne({ _id: decoded.id });
      if (!superAdmin) {
        return res.status(404).json({ 
          success: false,
          message: 'Superadmin not found' 
        });
      }
      if (!superAdmin.isActive) {
        return res.status(403).json({ 
          success: false,
          message: 'Superadmin account is inactive' 
        });
      }
      req.admin = superAdmin;
    } else {
      return res.status(403).json({ 
        success: false,
        message: 'Admin or Superadmin access required' 
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ 
      success: false,
      message: 'Invalid or expired token' 
    });
  }
};

const superAdminMiddleware = async (req, res, next) => {
  try {
    if (req.admin && req.user.role === 'superadmin') {
      next();
    } else {
      res.status(403).json({ 
        success: false,
        message: 'Superadmin access required' 
      });
    }
  } catch (error) {
    res.status(401).json({ 
      success: false,
      message: 'Invalid or expired token' 
    });
  }
};

// New middleware to check if a tenant is suspended
const checkTenantStatus = async (req, res, next) => {
  try {
    if (req.user.role === 'tenant') {
      const tenant = await Tenant.findById(req.user.id);
      
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

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
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking tenant status',
      error: error.message
    });
  }
};

module.exports = { 
  authMiddleware, 
  adminMiddleware, 
  superAdminMiddleware,
  checkTenantStatus 
};
