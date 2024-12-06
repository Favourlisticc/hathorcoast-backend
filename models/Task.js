const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Task description is required']
  },
  deadline: {
    type: Date,
    required: [true, 'Task deadline is required']
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed'],
    default: 'pending'
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date
});

const Task = mongoose.model('Task', TaskSchema);

module.exports = Task; 