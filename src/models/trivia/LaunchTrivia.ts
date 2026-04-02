import mongoose from 'mongoose';

import { TRIVIA_STATUS } from '@/types/trivia/trivia';

const LaunchTriviaSchema = new mongoose.Schema<ILaunchTrivia>(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    status: {
      type: String,
      enum: Object.values(TRIVIA_STATUS),
      default: TRIVIA_STATUS.PENDING,
    },
    launchAt: { type: Date },
    expiredAt: { type: Date, default: Date.now },
    launchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  },
  {
    timestamps: true, // Automatically manage `createdAt` and `updatedAt`
  }
);

const LaunchTrivia = mongoose.model<ILaunchTrivia>('LaunchTrivia', LaunchTriviaSchema);
export default LaunchTrivia;
