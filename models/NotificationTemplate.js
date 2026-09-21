const mongoose = require('mongoose');

const notificationTemplateSchema = new mongoose.Schema(
  {
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
    subject: {
      type: String,
      default: null,
      trim: true
    },
    body: {
      type: String,
      required: [true, 'Template body is required']
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active'
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index ensuring one template per event + channel pair
notificationTemplateSchema.index({ event: 1, channel: 1 }, { unique: true });

module.exports = mongoose.model('NotificationTemplate', notificationTemplateSchema);
