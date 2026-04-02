type ChatMessageType = 'private' | 'room';

interface IChatMessage extends Mongoose.Document {
  type: ChatMessageType;
  senderId: string;
  username: string;
  // For private messages
  recipientId?: string;
  // For room messages
  roomId?: string;
  avatar: string;
  isGif: boolean;
  gifId?: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}
