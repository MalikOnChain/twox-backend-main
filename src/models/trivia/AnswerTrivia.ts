import mongoose from 'mongoose';

import BonusService from '@/services/bonus/BonusService.service';
import { ANSWER_FORMAT, QUESTION_TYPE } from '@/types/trivia/trivia';

const AnswerTriviaSchema = new mongoose.Schema<IAnswerTrivia>(
  {
    launchId: { type: mongoose.Schema.Types.ObjectId, ref: 'LaunchTrivia' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    answers: { type: [mongoose.Schema.Types.Mixed], required: true },
    isCorrect: { type: Boolean, default: false },
    answeredAt: { type: Date, default: Date.now },
    isWinner: { type: Boolean, default: false },
  },
  {
    timestamps: true, // Automatically manage `createdAt` and `updatedAt`
  }
);

AnswerTriviaSchema.pre<IAnswerTrivia>('save', async function (next) {
  if (this.isNew) {
    const question = await mongoose.model('Question').findById(this.questionId);
    if (!question) {
      return next(new Error('Question not found'));
    }
    const winners = await mongoose
      .model('AnswerTrivia')
      .find({
        launchId: this.launchId,
        questionId: this.questionId,
        isWinner: true,
      })
      .countDocuments();
    if (winners >= question.maxWinners) {
      return next(new Error('Winner limit reached for this question'));
    }
    if (question.questionType === QUESTION_TYPE.MULTIPLE_CHOICE) {
      this.isCorrect = this.answers.every((answer: string) => question.answers.includes(answer));
    } else if (question.questionType === QUESTION_TYPE.FILL_IN_THE_BLANK) {
      this.isCorrect =
        question.answers.filter((answer: string) => {
          if (question.answerFormat === ANSWER_FORMAT.EXACT_MATCH) {
            return this.answers.includes(answer);
          } else if (question.answerFormat === ANSWER_FORMAT.CONTAINS_KEYWORDS) {
            return this.answers.some((userAnswer: string) => answer.includes(userAnswer));
          } else if (question.answerFormat === ANSWER_FORMAT.CASE_INSENSITIVE) {
            return this.answers.some((userAnswer: string) => answer.toLowerCase().includes(userAnswer.toLowerCase()));
          } else {
            return false;
          }
        }).length > 0;
    } else if (question.questionType === QUESTION_TYPE.TRUE_FALSE) {
      this.isCorrect = this.answers[0] === question.answers[0];
    }
    if (this.isCorrect) {
      // TODO: check the time with cooldown and time limit of question
      this.isWinner = this.isCorrect;
      BonusService.claimTriviaBonus(this.userId, question._id);
    }
  }
  next();
});

const AnswerTrivia = mongoose.model<IAnswerTrivia>('AnswerTrivia', AnswerTriviaSchema);

export default AnswerTrivia;
