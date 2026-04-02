import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema<IChatMessage>(
  {
    type: {
      type: String,
      enum: ['private', 'room'],
      required: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    // For private messages
    recipientId: {
      type: String,
      required: function () {
        return this.type === 'private';
      },
    },
    // For room messages
    roomId: {
      type: String,
      required: function () {
        return this.type === 'room';
      },
    },
    avatar: {
      type: String,
      required: true,
    },
    isGif: {
      type: Boolean,
      default: false,
    },
    gifId: {
      type: String,
      default: null,
    },
    message: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
chatMessageSchema.index({ senderId: 1, createdAt: -1 });
chatMessageSchema.index({ roomId: 1, createdAt: -1 });
chatMessageSchema.index({ recipientId: 1, createdAt: -1 });

const ChatMessage = mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);

export default ChatMessage;
