// Schema and Model
const mongoose = require('mongoose');

const AgentFeeSchema = new mongoose.Schema({
    fee: { type: Number, required: true },
    dateChanged: { type: Date, default: Date.now }
});

const AgentFee = mongoose.model('AgentFee', AgentFeeSchema);
module.exports = AgentFee;