type BannerPosition = 'top' | 'bottom' | 'left' | 'right';

type BannerLanguageCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'ar' | 'pt' | 'zh';

type BannerLanguageName = 'English' | 'Spanish' | 'French' | 'German' | 'Italian' | 'Arabic' | 'Portuguese' | 'Chinese';

type BannerDevice = 'mobile' | 'desktop' | 'tablet' | 'smartwatch';

type BannerSection =
  | 'home'
  | 'promotions'
  | 'games'
  | 'sports'
  | 'casino'
  | 'bonuses'
  | 'responsible-gambling'
  | 'new-user-registration'
  | 'payment-methods'
  | 'mobile-app'
  | 'live-betting'
  | 'vip-program'
  | 'events'
  | 'affiliate'
  | 'blog-news'
  | 'footer';

interface IBanner extends Mongoose.Document {
  title: string;
  image: string;
  position: BannerPosition;
  language: {
    code: BannerLanguageCode;
    name: BannerLanguageName;
  };
  device: BannerDevice;
  section: BannerSection;
  bannerData?: {
    title?: string;
    subtitle?: string;
    highlight?: string;
    features?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}
