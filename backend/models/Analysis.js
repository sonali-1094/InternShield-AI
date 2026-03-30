const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    detail: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium'],
      default: 'medium',
    },
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    contentType: { type: String, required: true, trim: true },
    source: {
      type: String,
      enum: ['openai', 'fallback', 'groq'], // ✅ groq added
      required: true,
    },
    status: {
      type: String,
      enum: ['SAFE', 'SUSPICIOUS', 'SCAM'],
      required: true,
    },
    trustScore: { type: Number, required: true, min: 0, max: 100 },
    redFlags: { type: [String], default: [] },
    recommendation: { type: String, default: '' },
    advice: { type: String, default: '' },
    explanation: { type: String, default: '' },
    preview: { type: String, default: '' },
    checklist: { type: [checklistItemSchema], default: [] },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    versionKey: false,
  }
);

module.exports = mongoose.model('Analysis', analysisSchema);