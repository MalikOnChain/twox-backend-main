interface IFavoriteGame extends Mongoose.Document {
  user: Mongoose.ObjectId;
  game: Mongoose.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
