import mongoose from 'mongoose';

import { ANSWER_FORMAT, LAUNCH_TYPE, QUESTION_TYPE } from '../../types/trivia/trivia';

const QuestionSchema = new mongoose.Schema<IQuestions>(
  {
    questionText: { type: String, required: true },

    questionType: {
      type: String,
      enum: Object.values(QUESTION_TYPE),
      required: true,
      default: QUESTION_TYPE.FILL_IN_THE_BLANK,
    },

    answers: {
      type: [String, Number],
      required: true,
      validate: {
        validator: function (v) {
          return v.length > 0;
        },
        message: (props) => `${props.value} is not a valid answer!`,
      },
    },

    questionTypeOptions: {
      type: [String],
      required() {
        return this.questionType === QUESTION_TYPE.MULTIPLE_CHOICE;
      },
    },

    answerFormat: {
      type: String,
      enum: Object.values(ANSWER_FORMAT),
      default: ANSWER_FORMAT.EXACT_MATCH,
    },

    timeLimit: { type: Number, default: null },

    maxWinners: { type: Number, required: true },

    reward: { type: Number, required: true },

    launchType: {
      type: String,
      enum: Object.values(LAUNCH_TYPE),
      required: true,
      default: LAUNCH_TYPE.MANUAL,
    },

    launchTime: {
      type: Date,
      required() {
        return this.launchType === LAUNCH_TYPE.SCHEDULED;
      },
    },

    cooldown: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Questions = mongoose.model<IQuestions>('Question', QuestionSchema);
export default Questions;
