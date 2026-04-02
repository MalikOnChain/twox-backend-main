import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import BonusBanner from '../models/content/BonusBanner';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../../.env') });

const seedBonusBanners = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/twox';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clear existing banners
    await BonusBanner.deleteMany({});
    console.log('🗑️  Cleared existing bonus banners');

    // Create 3 initial bonus banner slides
    const banners = [
      {
        title: 'Join Twox & Get',
        subtitle: '100% BONUS',
        highlight: 'UP TO 1 BTC!',
        image: '/images/bonus/spin.png',
        features: ['Fast Deposits', 'Instant Withdrawals', '24/7 Support'],
        buttonText: 'Join Now',
        order: 1,
        isActive: true,
      },
      {
        title: 'Welcome Bonus',
        subtitle: '200% MATCH',
        highlight: 'UP TO 2 BTC!',
        image: '/images/bonus/spin.png',
        features: ['No Wagering', 'Crypto Friendly', 'Instant Bonus'],
        buttonText: 'Claim Now',
        order: 2,
        isActive: true,
      },
      {
        title: 'VIP Rewards',
        subtitle: 'EXCLUSIVE BONUS',
        highlight: 'UP TO 5 BTC!',
        image: '/images/bonus/spin.png',
        features: ['VIP Cashback', 'Weekly Bonuses', 'Personal Manager'],
        buttonText: 'Join VIP',
        order: 3,
        isActive: true,
      },
    ];

    const createdBanners = await BonusBanner.insertMany(banners);
    console.log(`✅ Created ${createdBanners.length} bonus banners`);

    // Display created banners
    createdBanners.forEach((banner, index) => {
      console.log(`\n📊 Banner ${index + 1}:`);
      console.log(`   Title: ${banner.title}`);
      console.log(`   Subtitle: ${banner.subtitle}`);
      console.log(`   Highlight: ${banner.highlight}`);
      console.log(`   Features: ${banner.features.join(', ')}`);
      console.log(`   Order: ${banner.order}`);
      console.log(`   Active: ${banner.isActive}`);
    });

    console.log('\n✅ Bonus banner seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding bonus banners:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the seed function
seedBonusBanners();

