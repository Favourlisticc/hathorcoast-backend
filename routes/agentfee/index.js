const express = require('express');
const router = express.Router();
const AgentFee = require('../../models/agentfee');

// GET: Fetch all agent percentage fees
router.get('/', async (req, res) => {
    try {
        const fees = await AgentFee.find().sort({ dateChanged: -1 });
        res.json(fees);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch agent fees' });
    }
});

// POST: Add a new agent percentage fee
router.post('/', async (req, res) => {
    const { fee } = req.body;

    if (!fee || typeof fee !== 'number') {
        return res.status(400).json({ error: 'Fee must be a number' });
    }

    try {
        const newFee = new AgentFee({ fee });
        await newFee.save();
        res.status(201).json(newFee);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save agent fee' });
    }
});

// Export the router
module.exports = router;
