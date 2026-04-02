type QuestionType = 'MULTIPLE_CHOICE' | 'FILL_IN_THE_BLANK' | 'TRUE_FALSE' | string;

type AnswerFormat = 'EXACT_MATCH' | 'CONTAINS_KEYWORDS' | 'CASE_INSENSITIVE' | string;

type LaunchType = 'MANUAL' | 'SCHEDULED' | string;

interface IQuestions extends Mongoose.Document {
  questionText: string;
  questionType: QuestionType;
  answers: (string | number)[];
  questionTypeOptions?: string[];
  answerFormat: AnswerFormat;
  timeLimit?: number;
  maxWinners: number;
  reward: number;
  launchType: LaunchType;
  launchTime?: Date;
  cooldown: number;
  createdAt: Date;
  updatedAt: Date;
}
