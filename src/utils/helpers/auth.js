import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import config from '@/config';
import User from '@/models/users/User';
import UserCashbackBalance from '@/models/users/UserCashbackBalance';
import UserFreeSpinBalance from '@/models/users/UserFreeSpinBalance';
import UserReferBonusBalance from '@/models/users/UserReferBonusBalance';
import UserWagerRaceBalance from '@/models/users/UserWagerRaceBalance';
import { addTokenToState } from '@/services/auth/TokenState';
import userService from '@/services/user/User.service';
import { generateAvatarUrl } from '@/utils/helpers';

export const createNewUser = async (payload) => {
  const avatarUrl = payload?.avatar || generateAvatarUrl(payload?.username) || 'example.png';

  const newUser = new User({
    ...payload,
    avatar: avatarUrl,
  });
  await newUser.save();

  // Create UserCashbackBalance record for the new user
  await UserCashbackBalance.create({
    userId: newUser._id,
    cashbackBalance: 0,
    initialAmount: 0,
    wageringRequirement: 0,
    status: 'active',
  });

  await UserWagerRaceBalance.create({
    userId: newUser._id,
    cashbackBalance: 0,
    initialAmount: 0,
    wageringRequirement: 0,
  });

  await UserReferBonusBalance.create({
    userId: newUser._id,
    cashbackBalance: 0,
    initialAmount: 0,
    wageringRequirement: 0,
  });

  await UserFreeSpinBalance.create({
    userId: newUser._id,
    freeSpinBalance: 0,
    initialAmount: 0,
  });

  return newUser;
};

export const createJWTToken = async (userId, clientIP) => {
  return new Promise((resolve, reject) => {
    let payload = clientIP ? { user: { id: userId, ip: clientIP } } : { user: { id: userId } };
    jwt.sign(
      payload,
      config.authentication.jwtSecret,
      { expiresIn: config.authentication.jwtExpirationTime },
      (error, token) => {
        if (error) reject(error);
        resolve(token);
      }
    );
  });
};

export const createRefreshToken = async (userId, clientIP) => {
  return new Promise((resolve, reject) => {
    const payload = clientIP ? { user: { id: userId, ip: clientIP } } : { user: { id: userId } };
    jwt.sign(
      payload,
      config.authentication.refreshTokenSecret,
      { expiresIn: config.authentication.refreshTokenExpirationTime },
      (error, token) => {
        if (error) reject(error);
        resolve(token);
      }
    );
  });
};

export const setRefreshTokenCookie = (res, refreshToken) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true, // Prevent JavaScript access
    secure: isProd, // Required when sameSite is 'none'
    sameSite: isProd ? 'none' : 'lax', // Cross-origin frontends (e.g. Vercel → API) need 'none'
    maxAge: 1 * 24 * 60 * 60 * 1000, // 1 day - match with config.authentication.refreshTokenExpirationTime
    path: '/',
  });
};

export const generateIdentifier = async (user, clientIP, userAgent) => {
  const accessToken = await createJWTToken(user.id, clientIP);
  const refreshToken = await createRefreshToken(user.id, clientIP);
  const identifier = uuidv4(); // Generate a unique identifier for the token session
  await addTokenToState(identifier, accessToken, refreshToken);
  await userService.recordLogin(user.id, clientIP, userAgent);
  return identifier;
};

export const getClientIP = (req) => {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress ||
    null
  );
};

export const getClientUserAgent = (req) => {
  return req.headers['user-agent'] || null;
};
