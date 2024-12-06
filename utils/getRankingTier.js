const RankingTier = require('../models/RankingTier');

async function getAgentRankingTier(totalEarnings) {
  // Get all tiers sorted by minimumEarnings in descending order
  const tiers = await RankingTier.find().sort('-minimumEarnings');
  
  // Find the first tier where agent's earnings meet the minimum
  return tiers.find(tier => totalEarnings >= tier.minimumEarnings) || tiers[tiers.length - 1];
}

module.exports = { getAgentRankingTier }; 