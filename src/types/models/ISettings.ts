type SettingsGameCategory = 'slots' | 'live-casino' | 'crash' | string;

type XpSettingStatus = 'ACTIVE' | 'INACTIVE';

interface IWagerXpSetting {
  gameCategory: SettingsGameCategory;
  wagerXpAmount: number;
}

interface IXpSetting {
  status: XpSettingStatus;
  depositXpAmount: number;
  lossXpAmount: number;
  wagerXpSetting: IWagerXpSetting[];
}

interface LogoStyle {
  height: number;
  top: number;
  left: number;
}

interface SocialMediaSetting {
  logo: string;
  logoSymbol: string;
  logoStyle: LogoStyle;
  logoSymbolStyle: LogoStyle;
  title: string;
  slogan?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  whatsapp?: string;
  telegram?: string;
  discord?: string;
}

interface ISettings extends Mongoose.Document {
  depositMinAmount: number;
  withdrawMinAmount: number;
  withdrawMaxAmount: number;
  termsCondition?: string;
  xpSetting: IXpSetting;
  allowedCountries: string[];
  updatedAt: Date;
  socialMediaSetting: SocialMediaSetting;
}

// Static methods interface
interface ISettingsModel extends Mongoose.Model<ISettings> {
  getXpSettingStatus(): Promise<ISettings | null>;
  getWagerXpMultiplier(gameCategory: SettingsGameCategory): Promise<IWagerXpSetting | null>;
  getDepositXpMultiplier(): Promise<number>;
  getLossXpMultiplier(): Promise<ISettings | null>;
  getDepositSettings(): Promise<ISettings | null>;
}
