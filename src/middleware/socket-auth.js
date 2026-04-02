import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import { hashCode } from '@/utils/helpers/encrypt';

import config from '../config';
import User from '../models/users/User';
import { logger } from '../utils/logger';

const isPrivateNamespace = (namespace) => {
  return Object.values(config.socketNamespaces.PRIVATE).includes(namespace);
};

const socketAuthMiddleware = async (socket, next) => {
  try {
    const namespace = socket.nsp.name;
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    const secret = socket.handshake.auth.secret || socket.handshake.query.secret;

    const requiresAuth = isPrivateNamespace(namespace);

    if (!token && !secret && requiresAuth) {
      return next(new Error('Authentication required for this namespace'));
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, config.authentication.jwtSecret);
        const user = await User.aggregate([
          { $match: { _id: new mongoose.Types.ObjectId(decoded.user.id) } },
          {
            $lookup: {
              from: 'vipusers',
              localField: '_id',
              foreignField: 'userId',
              as: 'vipUser',
            },
          },
          { $unwind: { path: '$vipUser', preserveNullAndEmptyArrays: true } },
          {
            $addFields: {
              currentRank: '$vipUser.currentTier',
              currentLevel: '$vipUser.currentLevel',
            },
          },
          { $project: { password: 0, vipUser: 0 } },
        ]).then((res) => ({ ...res[0], id: decoded.user.id }));

        if (!user) {
          return next(new Error('User not found'));
        }

        if (user.isBanned) {
          return next(new Error('User is banned'));
        }

        // Attach user to socket and manage session
        socket.user = user;
        socket.join(`user:${user._id}`);
      } catch (error) {
        if (requiresAuth) {
          if (error.name === 'TokenExpiredError') {
            logger.error('TokenExpiredError', token);
          }

          return next(new Error('Invalid authentication token'));
        }
      }
    }

    if (secret) {
      const sharedToken = config.authentication.sharedToken;
      const hash = hashCode(sharedToken);
      if (secret.toString() !== hash.toString()) {
        return next(new Error('Invalid authentication'));
      }
      socket.shared = true;
    }

    next();
  } catch (error) {
    next(new Error('Internal server error'));
  }
};

export default socketAuthMiddleware;
