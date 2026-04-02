type EmailTemplateName = 'verifyEmail' | 'forgotPassword';

interface IEmailTemplate extends Mongoose.Document {
  name: EmailTemplateName;
  subject: string;
  html: string;
  requiredVariables: string[];
  createdAt: Date;
  updatedAt: Date;
}
