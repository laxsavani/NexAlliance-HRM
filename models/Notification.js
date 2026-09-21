const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required']
    },
    event: {
      type: String,
      required: [true, 'Event code is required'],
      trim: true
    },
    channel: {
      type: String,
      enum: ['EMAIL', 'IN_APP'],
      required: [true, 'Channel is required']
    },
    title: {
      type: String,
      trim: true,
      default: null
    },
    body: {
      type: String,
      required: [true, 'Notification body is required']
    },
    is_read: {
      type: Boolean,
      default: false
    },
    delivery_status: {
      type: String,
      enum: ['QUEUED', 'SENT', 'FAILED', 'N/A'],
      default: 'N/A'
    },
    ref_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Compound index optimized for in-app inbox queries and sorting
notificationSchema.index({ user_id: 1, channel: 1, is_read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
