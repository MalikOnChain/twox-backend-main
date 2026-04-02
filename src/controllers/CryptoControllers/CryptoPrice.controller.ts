import { Namespace } from 'socket.io';

import CryptoPriceService from '@/services/crypto/CryptoPrice.service';

class CryptoPriceController {
  private io: Namespace;
  private publishPriceInterval: number;

  constructor(io: Namespace) {
    this.io = io;
    this.publishPriceInterval = 30 * 1000;
    this.publishPrice();
  }

  private async publishPrice() {
    const prices = await CryptoPriceService.getAllPricesInUSD();
    this.io.emit('crypto-price', prices);
    setTimeout(() => {
      this.publishPrice();
    }, this.publishPriceInterval);
  }

  public async getPriceInUSD(currency: CRYPTO_CURRENCY) {
    const price = await CryptoPriceService.getPriceInUSD(currency);
    return price;
  }

  public async getAllPricesInUSD() {
    const prices = await CryptoPriceService.getAllPricesInUSD();
    return prices;
  }
}

export default CryptoPriceController;
