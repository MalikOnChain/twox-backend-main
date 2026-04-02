// types/casino/blueocean.ts

export interface IBlueOceanGame {
  _id: string;
  gameId: string;
  name: string;
  gamename: string;
  type: BlueOceanGameTypes;
  subcategory: string;
  category: string;
  system: string;
  provider: string;
  providerName: string;
  details: string;
  licence: string;
  report: string;
  isNewGame: boolean;
  position: number;
  plays: number;
  rtp: string;
  wagering: string | null;
  mobile: boolean;
  playForFunSupported: boolean;
  freeroundsSupported: boolean;
  featurebuySupported: boolean;
  hasJackpot: boolean;
  releaseDate: Date;
  showDate: Date;
  hideDate: Date | null;
  idHash: string;
  idParent: string;
  idHashParent: string;
  lottie: string | null;
  image: string;
  imagePreview: string;
  imageFilled: string;
  imagePortrait: string;
  imageSquare: string;
  imageBackground: string;
  imageLottie: string;
  imagePortraitLottie: string;
  imageSquareLottie: string;
  imageBw: string;
  status: 'active' | 'inactive' | 'hidden';
  isEnabled: boolean;
  isFeatured: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt: Date;
}

export interface IBlueOceanGameProvider {
  _id: string;
  provider: string;
  providerName: string;
  image: string;
  name: string;
  system: string;
  imageBlack: string;
  imageWhite: string;
  imageColored: string;
  imageSmallColor: string;
  imageSmallGray: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}

// API Request/Response types
export interface BlueOceanGamesListRequest {
  offset?: number;
  limit?: number;
  provider?: string;
  type?: string;
  query?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  userId?: string;
}

export interface BlueOceanGamesPagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface BlueOceanGamesListResponse {
  success: boolean;
  data: IBlueOceanGame[];
  pagination: BlueOceanGamesPagination;
  meta?: {
    requestParams: {
      offset: number;
      limit: number;
      provider: string;
      type?: string;
      query?: string;
      category?: string;
      sortBy: string;
      sortOrder: string;
    };
    timestamp: string;
  };
  message?: string;
}

export interface BlueOceanProvidersResponse {
  success: boolean;
  data: IBlueOceanGameProvider[];
  message?: string;
}

export interface BlueOceanCategoriesResponse {
  success: boolean;
  data: string[];
  message?: string;
}

export type BlueOceanGameTypes =
  | 'livecasino'
  | 'poker'
  | 'virtual-sports'
  | 'sportsbook'
  | 'live-casino-table'
  | 'video-slots'
  | 'table-games'
  | 'video-poker'
  | 'virtual-games'
  | 'scratch-cards'
  | 'video-bingo'
  | 'tournaments'
  | 'livegames'
  | 'crash-games'
  | 'fast-games';

export interface BlueOceanGameTypesResponse {
  success: boolean;
  data: string[];
  message?: string;
}

export interface BlueOceanGameStats {
  totalGames: number;
  activeGames: number;
  featuredGames: number;
  newGames: number;
  mobileGames: number;
  totalProviders: number;
  totalCategories: number;
  totalTypes: number;
}

export interface BlueOceanGameStatsResponse {
  success: boolean;
  data: BlueOceanGameStats;
  message?: string;
}

export interface BlueOceanGamesCountResponse {
  success: boolean;
  count: number;
  filters: {
    provider: string;
    type: string;
    category: string;
    query: string;
  };
  message?: string;
}

// For frontend components compatibility
export interface BlueOceanGameForTable {
  _id: string;
  name: string;
  gamename?: string;
  provider: string;
  providerName?: string;
  image: string;
  type: string;
  status: string;
}
