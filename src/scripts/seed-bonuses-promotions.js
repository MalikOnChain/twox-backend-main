import mongoose from 'mongoose';
import config from '@/config/index';
import { logger } from '@/utils/logger';
import Bonus from '@/models/bonus/Bonuses';
import Promotion from '@/models/promotion/Promotion';

/**
 * Seed sample bonuses and promotions for testing
 */
async function seedBonusesAndPromotions() {
  try {
    // Connect to database
    await mongoose.connect(config.database.mongoURI);
    logger.info('Connected to MongoDB');

    // Clear existing test data (optional)
    // Clear all bonuses and promotions for fresh seed
    await Bonus.deleteMany({});
    await Promotion.deleteMany({});
    logger.info('Cleared existing bonuses and promotions');

    // Create sample bonuses
    const bonuses = [
      {
        name: 'Welcome Bonus 100%',
        code: 'TEST_WELCOME100',
        description: 'Get 100% bonus on your first deposit up to $500',
        type: 'welcome',
        category: 'standard',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            amount: 50, // Fixed $50 bonus for testing
            percentage: 100,
            maxAmount: 500,
            minAmount: 10,
          }
        },
        wageringRequirement: {
          multiplier: 30,
          minOdds: 1.5,
        },
        eligibilityRestrictions: {
          isActive: false, // No restrictions - everyone can claim
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        imageUrl: '',
        termsAndConditions: 'Minimum deposit $10. Wagering requirement 30x. Valid for 30 days.',
      },
      {
        name: 'Daily Reload 50%',
        code: 'TEST_DAILY50',
        description: 'Daily 50% reload bonus up to $200',
        type: 'deposit',
        category: 'standard',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            amount: 25, // Fixed $25 bonus for testing
            percentage: 50,
            maxAmount: 200,
            minAmount: 5,
          }
        },
        wageringRequirement: {
          multiplier: 20,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        imageUrl: '',
        termsAndConditions: 'Available once per day. Minimum deposit $20. Wagering requirement 20x.',
      },
      {
        name: 'VIP Loss Rebate 10%',
        code: 'TEST_VIP_REBATE',
        description: 'Exclusive 10% loss rebate for VIP members',
        type: 'loss-rebate',
        category: 'vip',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            amount: 100, // Fixed $100 rebate for testing
            percentage: 10,
            maxAmount: 1000,
          }
        },
        wageringRequirement: {
          multiplier: 1, // No wagering on rebate
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        imageUrl: '',
        termsAndConditions: 'VIP members only. Calculated weekly on losses. Instant withdrawal.',
      },
      {
        name: '50 Free Spins',
        code: 'TEST_FREESPINS50',
        description: 'Get 50 free spins on selected slots',
        type: 'free-spins',
        category: 'promotional',
        status: 'active',
        isVisible: true,
        defaultReward: {
          freespins: {
            count: 50,
            valuePerSpin: 0.10,
          }
        },
        wageringRequirement: {
          multiplier: 40,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        imageUrl: '',
        termsAndConditions: 'Valid on Gates of Olympus, Sweet Bonanza. Max win $500. Wagering 40x.',
      },
      {
        name: 'Weekend Booster 75%',
        code: 'TEST_WEEKEND75',
        description: 'Special weekend bonus - 75% up to $300',
        type: 'deposit',
        category: 'promotional',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            percentage: 75,
            maxAmount: 300,
            minAmount: 15,
          }
        },
        wageringRequirement: {
          multiplier: 25,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        imageUrl: '',
        termsAndConditions: 'Available Friday-Sunday only. Minimum deposit $40. Wagering 25x.',
      },
      {
        name: 'High Roller Bonus',
        code: 'TEST_HIGHROLLER',
        description: 'Exclusive bonus for high rollers - 25% up to $5000',
        type: 'deposit',
        category: 'vip',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            percentage: 25,
            maxAmount: 5000,
            minAmount: 500,
          }
        },
        wageringRequirement: {
          multiplier: 15,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        imageUrl: '',
        termsAndConditions: 'VIP Diamond+ only. Minimum deposit $2000. Wagering 15x.',
      },
      {
        name: '200% Mega Welcome Bonus',
        code: 'MEGA200',
        description: 'Get 200% bonus on your first deposit up to $1000',
        type: 'welcome',
        category: 'standard',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            percentage: 100, // Schema max is 100%, but description shows 200%
            maxAmount: 1000,
            minAmount: 20,
          }
        },
        wageringRequirement: {
          multiplier: 35,
          minOdds: 1.5,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        imageUrl: '',
        termsAndConditions: 'New players only. Minimum deposit $20. Wagering requirement 35x. Valid for 90 days.',
      },
      {
        name: 'Second Deposit Bonus 75%',
        code: 'SECOND75',
        description: 'Get 75% bonus on your second deposit up to $750',
        type: 'deposit',
        category: 'standard',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            percentage: 75,
            maxAmount: 750,
            minAmount: 25,
          }
        },
        wageringRequirement: {
          multiplier: 30,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        imageUrl: '',
        termsAndConditions: 'Available for second deposit only. Minimum deposit $25. Wagering requirement 30x.',
      },
      {
        name: 'Third Deposit Bonus 50%',
        code: 'THIRD50',
        description: 'Get 50% bonus on your third deposit up to $500',
        type: 'deposit',
        category: 'standard',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            percentage: 50,
            maxAmount: 500,
            minAmount: 20,
          }
        },
        wageringRequirement: {
          multiplier: 25,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        imageUrl: '',
        termsAndConditions: 'Available for third deposit only. Minimum deposit $20. Wagering requirement 25x.',
      },
      {
        name: '100 Free Spins Welcome',
        code: 'FREESPINS100',
        description: 'Get 100 free spins on your first deposit',
        type: 'welcome',
        category: 'promotional',
        status: 'active',
        isVisible: true,
        defaultReward: {
          freespins: {
            count: 100,
            valuePerSpin: 0.20,
          }
        },
        wageringRequirement: {
          multiplier: 40,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        imageUrl: '',
        termsAndConditions: 'New players only. Valid on Book of Dead, Gates of Olympus. Max win $1000. Wagering 40x.',
      },
      {
        name: 'Cashback Bonus 10%',
        code: 'CASHBACK10',
        description: 'Get 10% cashback on all your losses',
        type: 'time-boost-cashback',
        category: 'standard',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            percentage: 10,
            maxAmount: 500,
          }
        },
        wageringRequirement: {
          multiplier: 1,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        imageUrl: '',
        termsAndConditions: 'Weekly cashback. Calculated every Monday. No wagering required. Instant withdrawal.',
      },
      {
        name: 'Birthday Bonus',
        code: 'BIRTHDAY',
        description: 'Special birthday bonus - $100 free bonus',
        type: 'custom',
        category: 'promotional',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            amount: 100,
          }
        },
        wageringRequirement: {
          multiplier: 20,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        imageUrl: '',
        termsAndConditions: 'Available on your birthday month. One-time claim. Wagering requirement 20x.',
      },
      {
        name: 'Lucky Friday Bonus',
        code: 'LUCKYFRIDAY',
        description: 'Every Friday - 150% bonus up to $1500',
        type: 'deposit',
        category: 'promotional',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            percentage: 100, // Schema max is 100%, but description shows 150%
            maxAmount: 1500,
            minAmount: 50,
          }
        },
        wageringRequirement: {
          multiplier: 30,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        imageUrl: '',
        termsAndConditions: 'Available every Friday. Minimum deposit $50. Wagering requirement 30x.',
      },
      {
        name: 'No Deposit Bonus',
        code: 'NODEPOSIT',
        description: 'Get $25 free bonus - no deposit required',
        type: 'welcome',
        category: 'promotional',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            amount: 25,
          }
        },
        wageringRequirement: {
          multiplier: 50,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        imageUrl: '',
        termsAndConditions: 'New players only. No deposit required. Wagering requirement 50x. Max withdrawal $500.',
      },
      {
        name: 'Referral Bonus',
        code: 'REFERRAL',
        description: 'Get $50 for each friend you refer',
        type: 'referral',
        category: 'standard',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            amount: 50,
          }
        },
        wageringRequirement: {
          multiplier: 1,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: null, // No expiry
        imageUrl: '',
        termsAndConditions: 'Get $50 when your friend makes their first deposit. No wagering required. Unlimited referrals.',
      },
      {
        name: 'Monthly Reload 60%',
        code: 'MONTHLY60',
        description: 'Monthly reload bonus - 60% up to $600',
        type: 'deposit',
        category: 'standard',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            percentage: 60,
            maxAmount: 600,
            minAmount: 30,
          }
        },
        wageringRequirement: {
          multiplier: 25,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        imageUrl: '',
        termsAndConditions: 'Available once per month. Minimum deposit $30. Wagering requirement 25x.',
      },
      {
        name: 'Crypto Deposit Bonus',
        code: 'CRYPTO100',
        description: 'Special 100% bonus for crypto deposits',
        type: 'deposit',
        category: 'promotional',
        status: 'active',
        isVisible: true,
        defaultReward: {
          cash: {
            percentage: 100,
            maxAmount: 1000,
            minAmount: 50,
          }
        },
        wageringRequirement: {
          multiplier: 30,
        },
        eligibilityRestrictions: {
          isActive: false,
        },
        validFrom: new Date(),
        validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        imageUrl: '',
        termsAndConditions: 'Crypto deposits only (BTC, ETH, USDT). Minimum deposit $50. Wagering requirement 30x.',
      },
    ];

    const insertedBonuses = await Bonus.insertMany(bonuses);
    logger.info(`✅ Successfully inserted ${insertedBonuses.length} sample bonuses`);

    // Create sample promotions
    const promotions = [
      {
        name: 'Grand Opening Celebration',
        summary: '200% Welcome Bonus + 100 Free Spins',
        colorTheme: 0,
        highlightText: 'LIMITED TIME',
        badge: 'NEW',
        buttons: [
          {
            text: 'Claim Now',
            link: '/bonus',
          }
        ],
        image: 'https://via.placeholder.com/800x400/FF6B6B/FFFFFF?text=Grand+Opening',
        description: '<h2>Grand Opening Celebration!</h2><p>Celebrate with us and get an amazing 200% welcome bonus up to $1000 plus 100 free spins on your first deposit!</p><ul><li>200% bonus up to $1000</li><li>100 free spins</li><li>30x wagering requirement</li></ul>',
        bonusId: insertedBonuses[0]._id,
        isPublic: true,
      },
      {
        name: 'Weekend Cash Rain',
        summary: 'Every weekend - 75% Reload Bonus',
        colorTheme: 1,
        highlightText: 'WEEKENDS ONLY',
        badge: 'HOT',
        buttons: [
          {
            text: 'Get Bonus',
            link: '/bonus',
          }
        ],
        image: 'https://via.placeholder.com/800x400/4ECDC4/FFFFFF?text=Weekend+Cash+Rain',
        description: '<h2>Weekend Cash Rain!</h2><p>Make your weekends more exciting with our 75% reload bonus every Friday, Saturday, and Sunday!</p><ul><li>75% bonus up to $300</li><li>Available all weekend</li><li>25x wagering</li></ul>',
        bonusId: insertedBonuses[4]._id,
        isPublic: true,
      },
      {
        name: 'VIP Elite Program',
        summary: 'Exclusive rewards for our VIP players',
        colorTheme: 2,
        highlightText: 'VIP ONLY',
        badge: 'EXCLUSIVE',
        buttons: [
          {
            text: 'Join VIP',
            link: '/vip',
          }
        ],
        image: 'https://via.placeholder.com/800x400/FFD93D/000000?text=VIP+Elite+Program',
        description: '<h2>VIP Elite Program</h2><p>Join our exclusive VIP program and enjoy premium benefits including higher cashback, personal account manager, and exclusive bonuses!</p><ul><li>Up to 15% cashback</li><li>Personal VIP manager</li><li>Exclusive bonuses</li><li>Faster withdrawals</li></ul>',
        bonusId: insertedBonuses[2]._id,
        isPublic: true,
      },
      {
        name: 'Crypto Bonus Special',
        summary: '50 Free Spins on Crypto Deposits',
        colorTheme: 0,
        highlightText: 'CRYPTO ONLY',
        badge: 'TRENDING',
        buttons: [
          {
            text: 'Deposit Crypto',
            link: '/deposit',
          }
        ],
        image: 'https://via.placeholder.com/800x400/95E1D3/FFFFFF?text=Crypto+Bonus',
        description: '<h2>Crypto Bonus Special!</h2><p>Deposit with cryptocurrency and receive 50 free spins instantly!</p><ul><li>50 free spins ($0.10 each)</li><li>No wagering required</li><li>BTC, ETH, USDT accepted</li></ul>',
        bonusId: insertedBonuses[3]._id,
        isPublic: true,
      },
      {
        name: 'Monthly Mystery Box',
        summary: 'Surprise rewards every month',
        colorTheme: 1,
        highlightText: 'MYSTERY REWARDS',
        badge: '🎁',
        buttons: [
          {
            text: 'Open Box',
            link: '/bonus',
          }
        ],
        image: 'https://via.placeholder.com/800x400/F38181/FFFFFF?text=Mystery+Box',
        description: '<h2>Monthly Mystery Box</h2><p>Every month, open your mystery box and discover amazing rewards including cash bonuses, free spins, and exclusive perks!</p><ul><li>Random rewards</li><li>Available monthly</li><li>Guaranteed value</li></ul>',
        isPublic: true,
      },
    ];

    const insertedPromotions = await Promotion.insertMany(promotions);
    logger.info(`✅ Successfully inserted ${insertedPromotions.length} sample promotions`);

    // Display summary
    console.log('\n=== Seed Summary ===');
    console.log(`Bonuses created: ${insertedBonuses.length}`);
    console.log(`Promotions created: ${insertedPromotions.length}`);
    
    console.log('\n=== Sample Bonuses ===');
    insertedBonuses.forEach((bonus, i) => {
      console.log(`${i + 1}. ${bonus.name} (${bonus.code})`);
      console.log(`   Type: ${bonus.type} | Category: ${bonus.category}`);
      console.log(`   Valid until: ${bonus.validTo?.toLocaleDateString() || 'No expiry'}`);
    });

    console.log('\n=== Sample Promotions ===');
    insertedPromotions.forEach((promo, i) => {
      console.log(`${i + 1}. ${promo.name}`);
      console.log(`   Summary: ${promo.summary}`);
      console.log(`   Public: ${promo.isPublic}`);
    });

    console.log('\n✅ Seed completed successfully!');
    console.log('You can now view bonuses at: http://localhost:3000/bonus');
    console.log('You can now view promotions at: http://localhost:3000/promotions\n');

  } catch (error) {
    logger.error('Failed to seed data:', error);
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run the seed function
seedBonusesAndPromotions();

