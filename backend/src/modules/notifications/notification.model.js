const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, trim: true, maxlength: 500 },
    // In-app route the notification opens, such as /my-assignment.
    link: { type: String, trim: true },
    channel: { type: String, enum: ['in-app', 'sms'], default: 'in-app' },
    // SMS delivery is simulated in the prototype; in-app delivery is immediate.
    deliveryStatus: { type: String, enum: ['delivered', 'failed', 'sms-fallback-sent'], default: 'delivered' },
    readAt: Date
  },
  { timestamps: true }
)

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema)
