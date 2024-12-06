const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware');
const { v4: uuidv4 } = require('uuid');
const Referral = require('../../models/Referral');
const Tenant = require('../../models/Tenant');
const calculateCommission = require('../../utils/calculateCommission');

// Generate referral code
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.tenant._id);
    if (!tenant) {
      return res.status(404).json({ message: 'Tenant not found' });
    }

    const referralCode = uuidv4().slice(0, 8).toUpperCase(); // Generate a unique 8-character code
    const newReferral = new Referral({
      referrer: req.tenant._id,
      referralCode: referralCode,
      status: 'pending'
    });

    await newReferral.save();

    res.status(201).json({ referralCode: referralCode });
  } catch (error) {
    console.error('Generate referral code error:', error);
    res.status(500).json({ message: 'Error generating referral code', error: error.message });
  }
});

// Get referrals for a tenant
router.get('/tenant', authMiddleware, async (req, res) => {
  try {
    const referrals = await Referral.find({ referrer: req.tenant._id })
      .populate('referred', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(referrals);
  } catch (error) {
    console.error('Fetch tenant referrals error:', error);
    res.status(500).json({ message: 'Error fetching referrals', error: error.message });
  }
});

// Update referral status (for landlords)
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'completed', 'expired'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const referral = await Referral.findById(id);
    if (!referral) {
      return res.status(404).json({ message: 'Referral not found' });
    }

    // Ensure the landlord owns this referral
    if (referral.landlord.toString() !== req.landlord._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this referral' });
    }

    referral.status = status;
    if (status === 'completed') {
      referral.completedAt = new Date();
      referral.commissionAmount = await calculateCommission(referral);
    }

    await referral.save();

    res.json(referral);
  } catch (error) {
    console.error('Update referral status error:', error);
    res.status(500).json({ message: 'Error updating referral status', error: error.message });
  }
});

// Verify referral code (for landlords when creating a new tenant)
router.get('/verify/:code', authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const referral = await Referral.findOne({ referralCode: code, status: 'pending' })
      .populate('referrer', 'firstName lastName');

    if (!referral) {
      return res.status(404).json({ message: 'Invalid or expired referral code' });
    }

    res.json({
      isValid: true,
      referrer: `${referral.referrer.firstName} ${referral.referrer.lastName}`
    });
  } catch (error) {
    console.error('Verify referral code error:', error);
    res.status(500).json({ message: 'Error verifying referral code', error: error.message });
  }
});

module.exports = router;
