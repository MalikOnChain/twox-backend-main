import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import config from '@/config';
import { addTokenToState } from '@/services/auth/TokenState';

export const createWaitingListJWTToken = async (waitingListUserId, clientIP) => {
  return new Promise((resolve, reject) => {
    let payload = clientIP ? { waitingListUser: { id: waitingListUserId, ip: clientIP } } : { waitingListUser: { id: waitingListUserId } };
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

export const createWaitingListRefreshToken = async (waitingListUserId, clientIP) => {
  return new Promise((resolve, reject) => {
    const payload = clientIP ? { waitingListUser: { id: waitingListUserId, ip: clientIP } } : { waitingListUser: { id: waitingListUserId } };
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

export const generateWaitingListIdentifier = async (waitingListUser, clientIP, userAgent) => {
  const accessToken = await createWaitingListJWTToken(waitingListUser.id, clientIP);
  const refreshToken = await createWaitingListRefreshToken(waitingListUser.id, clientIP);
  const identifier = uuidv4(); // Generate a unique identifier for the token session
  await addTokenToState(identifier, accessToken, refreshToken);
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

