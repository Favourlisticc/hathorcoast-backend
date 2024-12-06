const express = require('express');
const router = express.Router();
const RankingTier = require('../../models/RankingTier');
const Agent = require('../../models/Agent');
const { adminMiddleware } = require('../../middleware');

// Get all ranking tiers
router.get('/tiers', adminMiddleware, async (req, res) => {
  try {
    const tiers = await RankingTier.find();

    res.status(200).json({
      success: true,
      data: tiers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
});

// Create new ranking tier
router.post('/tiers', adminMiddleware, async (req, res) => {
  try {
    // Get the highest order number
    const highestTier = await RankingTier.findOne().sort('-order');
    const newOrder = (highestTier?.order || 0) + 1;

    const tier = await RankingTier.create({
      ...req.body,
      order: newOrder
    });

    res.status(201).json({
      success: true,
      data: tier
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update ranking tier
router.put('/tiers/:id', adminMiddleware, async (req, res) => {
  try {
    const tier = await RankingTier.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!tier) {
      return res.status(404).json({
        success: false,
        error: 'Tier not found'
      });
    }

    res.status(200).json({
      success: true,
      data: tier
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete ranking tier
router.delete('/tiers/:id', adminMiddleware, async (req, res) => {
  try {
    const tier = await RankingTier.findById(req.params.id);

    if (!tier) {
      return res.status(404).json({
        success: false,
        error: 'Tier not found'
      });
    }

    // Check if any agents are in this tier
    const agentsInTier = await Agent.countDocuments({
      'commission.totalEarned': { $gte: tier.minimumEarnings }
    });

    if (agentsInTier > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete tier with active agents'
      });
    }

    await tier.deleteOne();

    // Reorder remaining tiers
    const remainingTiers = await RankingTier.find().sort('order');
    for (let i = 0; i < remainingTiers.length; i++) {
      remainingTiers[i].order = i + 1;
      await remainingTiers[i].save();
    }

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Reorder tiers
router.put('/tiers/reorder', adminMiddleware, async (req, res) => {
  try {
    const { tierOrders } = req.body; // Array of { id, order }

    for (const { id, order } of tierOrders) {
      await RankingTier.findByIdAndUpdate(id, { order });
    }

    const updatedTiers = await RankingTier.find();

    res.status(200).json({
      success: true,
      data: updatedTiers
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get agent rankings
router.get('/agents', adminMiddleware, async (req, res) => {
  try {
    // Get all tiers first
    const tiers = await RankingTier.find().sort('-minimumEarnings');

    // Get all agents with their commission data
    const agents = await Agent.find({
      status: 'active'
    }).select('firstName lastName email commission businessName');

    // Calculate rankings and progress for each agent
    const agentRankings = agents.map(agent => {
      // Find current tier
      const currentTier = tiers.find(
        tier => agent.commission.totalEarned >= tier.minimumEarnings
      ) || tiers[tiers.length - 1];

      // Calculate progress to next tier
      let progressToNextTier = 100;
      const currentTierIndex = tiers.findIndex(
        tier => tier._id.toString() === currentTier._id.toString()
      );

      if (currentTierIndex > 0) {
        const nextTier = tiers[currentTierIndex - 1];
        progressToNextTier = Math.min(
          ((agent.commission.totalEarned - currentTier.minimumEarnings) /
          (nextTier.minimumEarnings - currentTier.minimumEarnings)) * 100,
          100
        );
      }

      // Calculate total bonus earned
      const totalBonus = (agent.commission.totalEarned * currentTier.bonus) / 100;

      return {
        _id: agent._id,
        firstName: agent.firstName,
        lastName: agent.lastName,
        email: agent.email,
        businessName: agent.businessName,
        currentTier: currentTier.name,
        totalEarnings: agent.commission.totalEarned,
        progressToNextTier,
        totalBonus,
        nextTierName: currentTierIndex > 0 ? tiers[currentTierIndex - 1].name : null,
        nextTierEarningsRequired: currentTierIndex > 0 ? tiers[currentTierIndex - 1].minimumEarnings : null
      };
    });

    // Sort by total earnings descending
    agentRankings.sort((a, b) => b.totalEarnings - a.totalEarnings);

    res.status(200).json({
      success: true,
      data: agentRankings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get ranking statistics
router.get('/statistics', adminMiddleware, async (req, res) => {
  try {
    const tiers = await RankingTier.find().sort('-minimumEarnings');
    const stats = await Promise.all(
      tiers.map(async (tier) => {
        const agentCount = await Agent.countDocuments({
          status: 'active',
          'commission.totalEarned': { $gte: tier.minimumEarnings }
        });

        const totalBonusPaid = await Agent.aggregate([
          {
            $match: {
              status: 'active',
              'commission.totalEarned': { $gte: tier.minimumEarnings }
            }
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: {
                  $multiply: ['$commission.totalEarned', tier.bonus / 100]
                }
              }
            }
          }
        ]);

        return {
          tier: tier.name,
          agentCount,
          totalBonusPaid: totalBonusPaid[0]?.total || 0
        };
      })
    );

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 