import Banner from '@/models/banner/Banner';

class BannerController {
  constructor() {}

  async getBanners() {
    const banners = await Banner.find().lean();
    return banners;
  }
}

export default new BannerController();
