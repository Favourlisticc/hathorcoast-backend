const express = require('express');
const router = express.Router();
const Agent = require('../../models/Agent');
const RankingTier = require('../../models/RankingTier');
const { getAgentRankingTier } = require('../../utils/getRankingTier'); 
const jwt = require('jsonwebtoken');

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

router.get('/my-ranking', protect, async (req, res) => {
  try {
    const agent = await Agent.findById(req.agent._id);
    if (!agent) {
      console.log('Agent not found')
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const totalEarnings = agent.commission.totalEarned;

    const tiers = await RankingTier.find().sort('-minimumEarnings');
    if (!tiers.length) {
      console.log('No ranking tiers found')
      return res.status(500).json({ success: false, error: 'No ranking tiers found' });
    }

    const currentTier = await getAgentRankingTier(totalEarnings);
    if (!currentTier) {
      console.log('No ranking tier found for the agent.')
      return res.status(404).json({ success: false, error: 'No ranking tier found for the agent.' });
    }

    let progressToNextTier = 100;
    const currentTierIndex = tiers.findIndex(
      tier => tier._id.toString() === currentTier._id.toString()
    );

    if (currentTierIndex > 0) {
      const nextTier = tiers[currentTierIndex - 1];
      progressToNextTier = Math.min(
        ((totalEarnings - currentTier.minimumEarnings) /
        (nextTier.minimumEarnings - currentTier.minimumEarnings)) * 100,
        100
      );

    }

    res.status(200).json({
      success: true,
      data: {
        currentTier: {
          name: currentTier.name,
          color: currentTier.color,
          bonus: currentTier.bonus
        },
        totalEarnings,
        progressToNextTier,
        nextTier: currentTierIndex > 0 ? {
          name: tiers[currentTierIndex - 1].name,
          minimumEarnings: tiers[currentTierIndex - 1].minimumEarnings
        } : null,
        allTiers: tiers.map(tier => ({
          name: tier.name,
          minimumEarnings: tier.minimumEarnings,
          bonus: tier.bonus,
          color: tier.color,
          isCurrentTier: tier._id.toString() === currentTier._id.toString()
        }))
      }
    });

    
  } catch (error) {
    console.log('Error fetching ranking:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// Get all agents rankings
router.get('/leaderboard', protect, async (req, res) => {
  try {
    const agents = await Agent.find({ status: 'active' })
      .select('firstName lastName businessName commission.totalEarned avatar')
      .sort('-commission.totalEarned')
      .limit(10);

    const rankedAgents = agents.map((agent, index) => {
      const tier = RankingTier.find(
        tier => agent.commission.totalEarned >= tier.minimumEarnings
      ) || RankingTiers[RankingTiers.length - 1];

      return {
        rank: index + 1,
        ...agent.toObject(),
        tier: tier.name
      };
    });

    res.status(200).json({
      success: true,
      data: rankedAgents
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 