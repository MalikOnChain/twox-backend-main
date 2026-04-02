type TriviaStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

interface ILaunchTrivia extends Mongoose.Document {
  questionId: Mongoose.ObjectId;
  status: TriviaStatus;
  launchAt?: Date;
  expiredAt: Date;
  launchedBy: Mongoose.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
