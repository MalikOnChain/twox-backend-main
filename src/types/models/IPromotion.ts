type ColorTheme = 0 | 1 | 2;

interface PromotionButton {
  text: string;
  link: string;
}

interface IPromotion extends Mongoose.Document {
  name: string;
  summary: string;
  colorTheme: ColorTheme;
  highlightText?: string;
  badge?: string;
  buttons: PromotionButton[];
  image: string;
  description: string;
  bonusId?: Mongoose.ObjectId;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}
