type GiphyType = 'gif' | 'sticker';

type RequestType = 'search' | 'trending' | 'random' | 'by_id' | 'by_category';

interface GiphyImage {
  url: string;
  width: string;
  height: string;
}

interface GiphyImages {
  original: GiphyImage;
  fixed_height: GiphyImage;
  fixed_width: GiphyImage;
  preview: GiphyImage;
  preview_webp: GiphyImage;
  fixed_height_small: GiphyImage;
  fixed_width_small: GiphyImage;
  fixed_width_still: GiphyImage;
  fixed_height_still: GiphyImage;
  downsized: GiphyImage;
  downsized_large: GiphyImage;
  downsized_medium: GiphyImage;
  downsized_small: GiphyImage;
}

interface IGiphyCache extends Mongoose.Document {
  // GIF metadata
  giphy_id: string;
  type: GiphyType;

  // URLs and content
  images: GiphyImages;

  // Metadata
  title?: string;
  rating?: string;
  source_tld?: string;
  source_post_url?: string;

  // Cache management
  request_type: RequestType;
  search_queries: string[];
  categories: string[];
  created_at: Date;
  last_accessed: Date;
  usage_count: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Methods
  updateUsage(): Promise<IGiphyCache>;
}

// Static methods interface
interface IGiphyCacheModel extends Mongoose.Model<IGiphyCache> {
  cacheGiphyResponse(giphyData: any, requestType: RequestType, query?: string): Promise<IGiphyCache>;
  findCachedResults(requestType: RequestType, query?: string, limit?: number): Promise<IGiphyCache[]>;
}
