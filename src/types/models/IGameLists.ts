type GameType = 'slot' | 'live';

type GameListStatus = 0 | 1;

interface IGameLists extends Mongoose.Document {
  id: number;
  game_code: string;
  provider_code: string;
  game_name: string;
  banner: string;
  type: GameType;
  status: GameListStatus;
  order?: number;
  is_pinned?: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Virtual Properties
  fullInfo: string;
}

// Static methods interface
interface IGameListsModel {
  findActive(): Promise<IGameLists[]>;
}
