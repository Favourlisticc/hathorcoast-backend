const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware');
const Agent = require('../../models/Agent');
const Landlord = require('../../models/Landlord');
const Tenant = require('../../models/Tenant');

router.get('/available-participants', authMiddleware, async (req, res) => {
  try {
    let participants = [];
    
    // If user is an agent
    if (req.agent) {
      // Populate more fields for landlords and tenants
      const landlords = await Landlord.find()
        .select('firstName lastName email phoneNumber profileImage') // Add any other fields you need
        .lean();
      
      const tenants = await Tenant.find()
        .select('firstName lastName contactInfo.email contactInfo.phoneNumber profileImage')
        .lean();

      participants = [
        ...landlords.map(l => ({
          _id: l._id,
          name: `${l.firstName} ${l.lastName}`,
          email: l.email,
          phoneNumber: l.phoneNumber,
          profileImage: l.profileImage,
          type: 'Landlord'
        })),
        ...tenants.map(t => ({
          _id: t._id,
          name: `${t.firstName} ${t.lastName}`,
          email: t.contactInfo.email,
          phoneNumber: t.contactInfo.phoneNumber,
          profileImage: t.profileImage,
          type: 'Tenant'
        }))
      ];
    }
    
    // If user is a landlord
    if (req.landlord) {
      const agents = await Agent.find()
        .select('firstName lastName email phoneNumber profileImage')
        .lean();
      
      const tenants = await Tenant.find()
        .select('firstName lastName contactInfo.email contactInfo.phoneNumber profileImage')
        .lean();

      participants = [
        ...agents.map(a => ({
          _id: a._id,
          name: `${a.firstName} ${a.lastName}`,
          email: a.email,
          phoneNumber: a.phoneNumber,
          profileImage: a.profileImage,
          type: 'Agent'
        })),
        ...tenants.map(t => ({
          _id: t._id,
          name: `${t.firstName} ${t.lastName}`,
          email: t.contactInfo.email,
          phoneNumber: t.contactInfo.phoneNumber,
          profileImage: t.profileImage,
          type: 'Tenant'
        }))
      ];
    }
    
    // If user is a tenant
    if (req.tenant) {
      const agents = await Agent.find()
        .select('firstName lastName email phoneNumber profileImage')
        .lean();
      
      const landlords = await Landlord.find()
        .select('firstName lastName email phoneNumber profileImage')
        .lean();

      participants = [
        ...agents.map(a => ({
          _id: a._id,
          name: `${a.firstName} ${a.lastName}`,
          email: a.email,
          phoneNumber: a.phoneNumber,
          profileImage: a.profileImage,
          type: 'Agent'
        })),
        ...landlords.map(l => ({
          _id: l._id,
          name: `${l.firstName} ${l.lastName}`,
          email: l.email,
          phoneNumber: l.phoneNumber,
          profileImage: l.profileImage,
          type: 'Landlord'
        }))
      ];
    }

    res.json(participants);
  } catch (error) {
    console.error('Error in available-participants:', error);
    res.status(500).json({ error: 'Failed to fetch available participants' });
  }
});

module.exports = router;