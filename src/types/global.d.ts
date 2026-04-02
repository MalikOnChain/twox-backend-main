import { NextFunction as ExpressNextFunction } from 'express';
import mongoose from 'mongoose';

import { Time as TimeType } from '@/utils/helpers/moment';

// Declare global variables

interface IdDeclaration {
  _id: any;
}

declare global {
  // Global helper variables
  let current_time: string;
  let current_date: string;
  let current_timestamp: string;
  let Time: typeof TimeType;
  let jsonStringify: (obj: any) => string | null;
  let jsonParse: (str: string) => any | null;
  let getNetwork: (blockchain: string) => string;
  namespace Express {
    interface Request {
      user?: any;
      isAuthenticated?: boolean;
      referralCode?: string;
      imageUrl?: string;
      isTestMode?: boolean;
    }
  }

  namespace Mongoose {
    type Document = mongoose.Document & IdDeclaration;
    type ObjectId = mongoose.Types.ObjectId;
    type Model<T extends Document = Document> = mongoose.Model<T>;
    namespace Schema {
      type Types = typeof mongoose.Schema.Types;
      type ObjectId = mongoose.Schema.Types.ObjectId;
      type String = mongoose.Schema.Types.String;
      type Number = mongoose.Schema.Types.Number;
      type Date = mongoose.Schema.Types.Date;
      type Boolean = mongoose.Schema.Types.Boolean;
      type Array = mongoose.Schema.Types.Array;
      type Mixed = mongoose.Schema.Types.Mixed;
      type Buffer = mongoose.Schema.Types.Buffer;
      type Decimal128 = mongoose.Schema.Types.Decimal128;
      type Map = mongoose.Schema.Types.Map;
    }
  }

  // Make NextFunction available globally
  type NextFunction = ExpressNextFunction;
}

// Extend Socket.IO Socket interface
declare module 'socket.io' {
  interface Socket {
    isAuthenticated?: boolean;
    user?: any;
  }
}

// This export is needed to make the file a module
export {};
