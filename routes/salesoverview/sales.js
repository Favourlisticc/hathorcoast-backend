// Backend route to fetch agent names and their commissions earned
const express = require('express');
const router = express.Router();
const Agent = require('../../models/Agent'); // Adjust the path based on your folder structure

// Route: GET /agents/top-commissions
router.get('/top-commissions', async (req, res) => {
  try {
    // Fetch agents with their names and total commissions earned
    const agents = await Agent.find({}, 'firstName lastName commission.totalEarned')
      .sort({ 'commission.totalEarned': -1 }) // Sort by total earned commission in descending order
      .limit(6); // Limit to the top 6 agents

    // Format the data for the frontend
    const formattedData = agents.map(agent => ({
      name: `${agent.firstName} ${agent.lastName}`,
      totalEarned: agent.commission.totalEarned
    }));

    res.status(200).json({
      success: true,
      data: formattedData,
    });
  } catch (error) {
    console.error('Error fetching top commissions:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching data.',
      error: error.message
    });
  }
});

module.exports = router;
