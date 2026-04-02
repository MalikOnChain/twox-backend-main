interface IAnswerTrivia extends Mongoose.Document {
  launchId: Mongoose.ObjectId;
  userId: Mongoose.ObjectId;
  questionId: Mongoose.ObjectId;
  answers: any;
  isCorrect: boolean;
  answeredAt: Date;
  isWinner: boolean;
  createdAt: Date;
  updatedAt: Date;
}
