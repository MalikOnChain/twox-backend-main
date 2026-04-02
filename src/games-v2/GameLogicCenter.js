import crypto from 'crypto';

import config from '../config';

// Base class for random generation
export class BaseRandomGenerator {
  constructor() {
    this.SALT_ROUNDS = 5;
    this.SALT = config.games.crash.salt || process.env.GAME_SALT;

    if (!this.SALT) {
      throw new Error('Game salt must be provided in environment variables or config');
    }
  }

  async generateNonce() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 100000000).toString();
    return crypto
      .createHash('sha256')
      .update(timestamp + random)
      .digest('hex');
  }

  async generatePrivateSeed() {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(256, (error, buffer) => {
        if (error) reject(error);
        else resolve(buffer.toString('hex'));
      });
    });
  }

  async generateCommitment(privateSeed) {
    const commitment = crypto.createHash('sha256').update(privateSeed).digest('hex');
    return commitment;
  }

  async generatePublicSeed(privateSeed, nonce) {
    return new Promise((resolve, reject) => {
      try {
        const combinedInput = `${privateSeed}:${nonce}`;
        const hash = crypto.createHash('sha256').update(combinedInput).digest('hex');
        resolve(hash);
      } catch (error) {
        reject(error);
      }
    });
  }

  async generateGameHash(privateSeed, publicSeed) {
    let gameHash = crypto
      .createHash('sha256')
      .update(privateSeed + publicSeed)
      .digest('hex');

    for (let i = 0; i < this.SALT_ROUNDS; i++) {
      gameHash = crypto.createHash('sha256').update(`${gameHash}:${this.SALT}:${i}`).digest('hex');
    }

    return gameHash;
  }
}

// Specialized class for crash game
export class CrashGameGenerator extends BaseRandomGenerator {
  #privateSeed;
  #publicSeed;
  #commitment;
  #crashPoint;
  #gameHash;
  #currentNonce;

  constructor() {
    super();
    this.MAX_MULTIPLIER = 15000;
    this.MIN_MULTIPLIER = 100;
    this.#privateSeed = null;
    this.#publicSeed = null;
    this.#commitment = null;
    this.#crashPoint = null;
    this.#gameHash = null;
    this.#currentNonce = null;
  }

  generateCrashPoint(privateSeed, publicSeed) {
    if (!privateSeed || !publicSeed) {
      throw new Error('Private seed and public seed are required');
    }

    const hash = crypto.createHmac('sha256', String(privateSeed)).update(String(publicSeed)).digest('hex');

    // console.log('Generated Hash:', hash);

    const h = parseInt(hash.slice(0, 16), 16);
    // console.log('Parsed h:', h);

    const e = Math.pow(2, 52);
    let result = (h % e) / e;
    if (result >= 1) {
      result = 0.999999; // ✅ Prevents crashPoint from breaking
    }

    // console.log('Computed result:', result);

    const houseEdge = config.games.crash.houseEdge;
    // console.log('House Edge:', houseEdge);

    let crashPoint = Math.floor((100 / (1 - result)) * (1 - houseEdge));
    // console.log('Calculated Crash Point Before Limits:', crashPoint);

    if (crashPoint > this.MAX_MULTIPLIER) {
      const h2 = parseInt(hash.slice(16, 32), 16);
      // console.log('Parsed h2:', h2);

      crashPoint = this.MAX_MULTIPLIER - (h2 % 5000);
    }

    crashPoint = Math.max(this.MIN_MULTIPLIER, Math.min(crashPoint, this.MAX_MULTIPLIER));
    // console.log('Final Crash Point:', crashPoint);

    return crashPoint;
  }

  async generateCrashRandom() {
    this.#privateSeed = await this.generatePrivateSeed();
    this.#commitment = await this.generateCommitment(this.#privateSeed);
    this.#currentNonce = await this.generateNonce();
    this.#publicSeed = await this.generatePublicSeed(this.#privateSeed, this.#currentNonce);
    this.#crashPoint = this.generateCrashPoint(this.#privateSeed, this.#publicSeed);
    this.#gameHash = await this.generateGameHash(this.#privateSeed, this.#publicSeed);

    return {
      privateSeed: this.#privateSeed,
      commitment: this.#commitment,
      publicSeed: this.#publicSeed,
      crashPoint: this.#crashPoint,
      gameHash: this.#gameHash,
    };
  }

  async verifyCommitment(commitment, privateSeed) {
    const calculatedCommitment = await this.generateCommitment(privateSeed);
    return commitment === calculatedCommitment;
  }

  async verifyCrashPoint(privateSeed, publicSeed, expectedCrashPoint) {
    const calculatedCrashPoint = this.generateCrashPoint(privateSeed, publicSeed);
    const gameHash = await this.generateGameHash(privateSeed, publicSeed);

    return {
      isValid: calculatedCrashPoint === expectedCrashPoint,
      calculatedCrashPoint,
      gameHash,
    };
  }
}

// Export both classes and create a singleton instance of CrashGameGenerator
const crashGameGenerator = new CrashGameGenerator();
export { crashGameGenerator };

// Usage example:
/*
const { crashGameGenerator } = require('./CrashGameGenerator');

async function example() {
  try {
    // Generate initial values
    const privateSeed = await crashGameGenerator.generatePrivateSeed();
    const nonce = await crashGameGenerator.generateNonce();
    console.log('Initial Values:', { privateSeed, nonce });

    // Generate crash point with game hash
    const crashResult = await crashGameGenerator.generateCrashRandom(privateSeed);
    console.log('Crash Result:', crashResult);

    // Verify the crash point
    const verification = await crashGameGenerator.verifyCrashPoint(
      privateSeed,
      crashResult.publicSeed,
      crashResult.crashPoint
    );
    console.log('Verification:', verification);

    // Store the gameHash for future verification
    console.log('Game Hash:', crashResult.gameHash);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
example();
*/
