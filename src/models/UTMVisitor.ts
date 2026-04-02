import mongoose from 'mongoose';

import { UTMSource } from '@/types/utm/utm';

const UTMVisitorSchema = new mongoose.Schema<IUTMVisitor>(
  {
    utm_source: {
      type: String,
      enum: Object.values(UTMSource),
      sparse: true,
    },
    utm_campaign: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Promotion',
      required: true,
      index: true,
    },
    ip_address: String,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IUTMVisitor>('UTMVisitor', UTMVisitorSchema);
