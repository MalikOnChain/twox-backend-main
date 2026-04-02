import md5 from 'md5';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import speakeasy from 'speakeasy';

import User from '@/models/users/User';

export class AuthService {
  async setup2FA(userId) {
    const user = await User.findOne({ _id: userId });
    let otpSecret = user?.otpSecret || authenticator.generateSecret();

    const otpAuthUrl = authenticator.keyuri(user.email || user.providerId, 'bitstake', otpSecret);

    const qrDataUri = await QRCode.toDataURL(otpAuthUrl);

    user.otpSecret = otpSecret;
    await user.save();

    return {
      otp_base32: otpSecret,
      qr_code_base64: qrDataUri,
    };
  }

  async verify2FA(userId, otp) {
    const user = await User.findOne({ _id: userId });

    if (!user.otpSecret) {
      throw new Error('OTP not set up for this user.');
    }

    const verified = speakeasy.totp.verify({
      secret: user.otpSecret,
      encoding: 'base32',
      token: otp,
      window: 1,
    });

    if (verified) {
      user.enabledTwoFA = true;
      await user.save();
      return true;
    }

    return false;
  }

  async disable2FA(userId) {
    const user = await User.findOne({ _id: userId });
    user.enabledTwoFA = false;
    user.otpSecret = null;
    await user.save();
    return true;
  }

  async invalidateAllTokens(userId) {
    return await User.updateOne({ _id: userId }, { $set: { tokens: [] } });
  }

  async check2FAPassword(userId, password) {
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return {
        success: false,
        msg: 'User not found',
      };
    }

    const encryptedPassword = this.encryptPassword(password);
    if (user.password !== encryptedPassword) {
      return {
        success: false,
        msg: 'Incorrect password!',
      };
    }

    if (!user.enabledTwoFA) {
      const secret = speakeasy.generateSecret({ length: 20 });
      const otpauth_url = speakeasy.otpauthURL({
        secret: secret.base32,
        label: user.email,
        issuer: 'Canguard',
        encoding: 'base32',
      });

      user.otpSecret = secret.base32;
      await user.save();

      return {
        success: true,
        qrcode: otpauth_url,
        token: user.otpSecret,
      };
    } else {
      user.enabledTwoFA = false;
      user.otpSecret = null;
      await user.save();

      return {
        success: true,
        msg: 'Two-factor authentication has been successfully deactivated.',
      };
    }
  }

  encryptPassword(password) {
    return md5('BestAuthSystemv1.0InTheBuilding-' + password);
  }
}

export default new AuthService();
