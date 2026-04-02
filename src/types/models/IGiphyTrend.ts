interface IGiphyTrend extends Mongoose.Document {
  gifId: string;
  usageCount: number;
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Static methods interface
interface IGiphyTrendModel extends Mongoose.Model<IGiphyTrend> {
  incrementUsage(gifId: string): Promise<IGiphyTrend>;
  getPopularGifs(limit: number): Promise<IGiphyTrend[]>;
}
