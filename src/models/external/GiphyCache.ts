import mongoose from 'mongoose';

const giphySchema = new mongoose.Schema<IGiphyCache>(
  {
    // GIF metadata
    giphy_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['gif', 'sticker'],
      default: 'gif',
    },

    // URLs and content
    images: {
      original: {
        url: String,
        width: String,
        height: String,
      },
      fixed_height: {
        url: String,
        width: String,
        height: String,
      },
      fixed_width: {
        url: String,
        width: String,
        height: String,
      },
      preview: {
        url: String,
        width: String,
        height: String,
      },
      preview_webp: {
        url: String,
        width: String,
        height: String,
      },
      fixed_height_small: {
        url: String,
        width: String,
        height: String,
      },
      fixed_width_small: {
        url: String,
        width: String,
        height: String,
      },
      fixed_width_still: {
        url: String,
        width: String,
        height: String,
      },
      fixed_height_still: {
        url: String,
        width: String,
        height: String,
      },
      downsized: {
        url: String,
        width: String,
        height: String,
      },
      downsized_large: {
        url: String,
        width: String,
        height: String,
      },
      downsized_medium: {
        url: String,
        width: String,
        height: String,
      },
      downsized_small: {
        url: String,
        width: String,
        height: String,
      },
    },

    // Metadata
    title: String,
    rating: String,
    source_tld: String,
    source_post_url: String,

    // Cache management
    request_type: {
      type: String,
      enum: ['search', 'trending', 'random', 'by_id', 'by_category'],
      required: true,
      index: true,
    },
    search_queries: [
      {
        type: String,
        index: true,
      },
    ],
    categories: [
      {
        type: String,
        index: true,
      },
    ],
    created_at: {
      type: Date,
      default: Date.now,
    },
    last_accessed: {
      type: Date,
      default: Date.now,
    },
    usage_count: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
giphySchema.index({ search_queries: 'text', title: 'text' });
giphySchema.index({ request_type: 1, search_queries: 1 });
giphySchema.index({ request_type: 1, categories: 1 });

// Update usage statistics
giphySchema.methods.updateUsage = function () {
  this.last_accessed = new Date();
  this.usage_count += 1;
  return this.save();
};

// Static methods for different types of requests
giphySchema.statics.cacheGiphyResponse = async function (
  giphyData: any,
  requestType: string,
  query: string | null = null
) {
  try {
    const gifData: any = {
      giphy_id: giphyData.id,
      type: giphyData.type,
      images: {
        original: giphyData.images?.original,
        fixed_height: giphyData.images?.fixed_height,
        fixed_width: giphyData.images?.fixed_width,
        preview: giphyData.images?.preview_gif,
        preview_webp: giphyData.images?.preview_webp,
        fixed_height_small: giphyData.images?.fixed_height_small,
        fixed_width_small: giphyData.images?.fixed_width_small,
        fixed_width_still: giphyData.images?.fixed_width_still,
        fixed_height_still: giphyData.images?.fixed_height_still,
        downsized: giphyData.images?.downsized,
        downsized_large: giphyData.images?.downsized_large,
        downsized_medium: giphyData.images?.downsized_medium,
        downsized_small: giphyData.images?.downsized_small,
      },
      title: giphyData.title,
      rating: giphyData.rating,
      source_tld: giphyData.source_tld,
      source_post_url: giphyData.source_post_url,
      request_type: requestType,
      search_queries: [],
      categories: [],
    };

    let gif = await this.findOne({ giphy_id: giphyData.id });

    if (!gif) {
      // For new GIFs, initialize with arrays
      gifData.search_queries = requestType === 'search' ? [query] : [];
      gifData.categories = requestType === 'by_category' ? [query] : [];
      gif = await this.create(gifData);
    } else {
      // For existing GIFs, add new query/category if not already present
      if (requestType === 'search' && query && !gif.search_queries.includes(query)) {
        gif.search_queries.push(query);
      } else if (requestType === 'by_category' && query && !gif.categories.includes(query)) {
        gif.categories.push(query);
      }
      await gif.save();
      await gif.updateUsage();
    }

    return gif;
  } catch (error) {
    console.error('Error in cacheGiphyResponse:', error);
    throw error;
  }
};

// Find cached results
giphySchema.statics.findCachedResults = async function (
  requestType: string,
  query: string | null = null,
  limit: number = 10
) {
  const cacheAge = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

  const queryObj: any = {
    request_type: requestType,
    created_at: { $gt: cacheAge },
  };

  if (query) {
    if (requestType === 'search') {
      queryObj.search_queries = { $in: [query] }; // Use $in operator for array search
    } else if (requestType === 'by_category') {
      queryObj.categories = { $in: [query] }; // Use $in operator for array search
    }
  }

  return this.find(queryObj).sort({ last_accessed: -1 }).limit(limit);
};

const Giphy = mongoose.model<IGiphyCache, IGiphyCacheModel>('Giphy', giphySchema);

export default Giphy;
