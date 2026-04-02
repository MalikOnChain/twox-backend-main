import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ContentSection from '../models/content/ContentSection.js';

dotenv.config();

const sampleContentSections = [
  {
    title: 'Online Casino Games at TWOX Casino - Best Online Gambling Games',
    content: `Since 2024, Twox.com has offered the best online casino gaming experience, compatible with local currencies, Bitcoin and other crypto on the web.

Starting with Stake Originals, our first-party casino games developed here at Stake, the online casino gaming platform has grown to host over 3000 casino games from the best providers in the iGaming industry. Players come back to Twox.com time and time again for our high-quality and dynamic online slots and immersive live casino games.

Every month, we wrap up the biggest and best wins by our Stake community on our monthly blog. Check out the latest wins and get inspired to play your favorite games at Twox.com.`,
    listItems: [
      'Easter',
      'Lunar New Year',
      'Oktoberfest',
      'Seasonal',
      'Carnaval Brasil',
      'Fantasy & Adventure',
      'Fantasy',
      'Dragons',
      'Magic',
      'Adventure',
    ],
    isActive: true,
    order: 0,
  },
];

async function seedContentSections() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing content sections
    await ContentSection.deleteMany({});
    console.log('Cleared existing content sections');

    // Insert sample data
    const sections = await ContentSection.insertMany(sampleContentSections);
    console.log(`✅ Created ${sections.length} content section(s)`);

    sections.forEach((section) => {
      console.log(`   - ${section.title}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error seeding content sections:', error);
    process.exit(1);
  }
}

seedContentSections();

