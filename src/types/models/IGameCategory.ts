interface IGameCategory extends Mongoose.Document {
  title: string;
  gameIds: string[];
  isPinned: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
