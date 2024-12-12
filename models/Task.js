const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  task: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true
  },
  deadline: {
    type: Date,
    required: [true, 'Task deadline is required']
  },
  assignedTo: {
    type: [String],
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  Status: {
    type: String,
    emu: ["all", "pending", "in_progress", "completed"],
    defualt: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date
});

const Task = mongoose.model('Task', TaskSchema);

module.exports = Task; 