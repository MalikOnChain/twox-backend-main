type ProviderType = 'slot' | 'live';

type ProviderStatus = 0 | 1;

interface IGameProvider extends Mongoose.Document {
  code: string;
  name: string;
  type: ProviderType;
  status: ProviderStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Static methods interface
interface IGameProviderModel extends Mongoose.Model<IGameProvider> {
  getActiveProviders(): Promise<IGameProvider[]>;
}
