import mongoose from 'mongoose';

import { ADMIN_REVIEW_STATUS, KYC_STATUS } from '../../types/kyc/kyc';

const { Schema } = mongoose;

const KYCSchema = new Schema<IKYC>(
  {
    userId: {
      // type: Schema.Types.ObjectId,
      type: String,
      // ref: 'User',
      required: true,
      index: true,
    },
    sumsubApplicantId: {
      type: String,
      index: true,
    },
    sumsubInspectionId: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(KYC_STATUS),
      default: KYC_STATUS.PENDING,
      index: true,
    },
    personalInfo: {
      firstName: String,
      lastName: String,
      middleName: String,
      gender: String,
      dateOfBirth: Date,
      placeOfBirth: String,
      nationality: String,
      email: String,
      phone: String,
    },
    address: {
      country: String,
      state: String,
      city: String,
      street: String,
      postalCode: String,
      residentialAddress: String,
    },

    // type: doc.idDocType,
    // country: doc.country,
    // number: doc.number,
    // issuedDate: doc.issuedDate,
    // validUntil: doc.validUntil,
    // issueAuthority: doc.issueAuthority,

    identityDocument: {
      type: {
        type: String,
      },
      country: {
        type: String,
      },
      number: {
        type: String,
      },
      issuedDate: {
        type: Date,
      },
      validUntil: {
        type: Date,
      },
      issueAuthority: {
        type: String,
      },
      frontImagePath: {
        type: String,
      },
      backImagePath: {
        type: String,
      },
      selfieImagePath: {
        type: String,
      },
    },
    proofOfAddress: {
      type: {
        type: String,
        enum: ['utility_bill', 'bank_statement', 'tax_return', 'other'],
      },
      issueDate: Date,
      documentPath: String,
    },
    additionalDocuments: [
      {
        type: {
          type: String,
          enum: ['tax_id', 'social_security', 'other'],
        },
        number: String,
        issuedDate: Date,
        expiryDate: Date,
        documentPath: String,
        description: String,
      },
    ],
    verificationLevel: {
      type: String,
      enum: ['basic-kyc', 'advanced-kyc', 'id-and-liveness', 'phone-level'],
      default: 'basic-kyc',
    },
    reviewResult: {
      answer: {
        type: String,
        enum: ['GREEN', 'RED', 'YELLOW'],
      },
      rejectLabels: [String],
      moderationComment: String,
      reviewerNotes: String,
    },
    adminReview: {
      status: {
        type: String,
        enum: Object.values(ADMIN_REVIEW_STATUS),
        default: ADMIN_REVIEW_STATUS.PENDING,
      },
      reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin',
      },
      reviewedAt: Date,
      notes: String,
      rejectionReason: String,
    },
    metadata: {
      applicantType: String,
      clientId: String,
      correlationId: String,
      sandboxMode: {
        type: Boolean,
        default: false,
      },
      ipAddress: String,
      userAgent: String,
      deviceInfo: Schema.Types.Mixed,
    },
    riskAssessment: {
      riskLevel: {
        type: String,
        enum: ['low', 'medium', 'high'],
      },
      flags: [String],
      score: Number,
      notes: String,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastAttemptAt: Date,
    verifiedAt: Date,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
KYCSchema.index({ status: 1, createdAt: -1 });
KYCSchema.index({ 'adminReview.status': 1 });
KYCSchema.index({ 'personalInfo.email': 1 });
KYCSchema.index({ 'personalInfo.phone': 1 });

// Instance methods
KYCSchema.methods.isVerified = function () {
  return this.status === 'completed' && this.reviewResult?.answer === 'GREEN' && this.adminReview.status === 'approved';
};

KYCSchema.methods.updateFromWebhook = function (webhookData: any) {
  const { type, reviewStatus, reviewResult } = webhookData;

  this.status = reviewStatus;
  if (reviewResult) {
    this.reviewResult = {
      answer: reviewResult.reviewAnswer,
      rejectLabels: reviewResult.rejectLabels,
      moderationComment: reviewResult.moderationComment,
    };
  }

  if (type === 'applicantReviewed' && reviewStatus === 'completed') {
    this.verifiedAt = new Date();
  }

  return this.save();
};

KYCSchema.methods.updateDocumentPaths = function (paths: any) {
  if (!this.identityDocument) {
    this.identityDocument = {};
  }

  if (!this.proofOfAddress) {
    this.proofOfAddress = {};
  }

  if (paths.frontImage) this.identityDocument.frontImagePath = paths.frontImage;
  if (paths.backImage) this.identityDocument.backImagePath = paths.backImage;
  if (paths.selfieImage) this.identityDocument.selfieImagePath = paths.selfieImage;
  if (paths.proofOfAddress) this.proofOfAddress.documentPath = paths.proofOfAddress;

  return this.save();
};

// Static methods
KYCSchema.statics.findByApplicantId = function (applicantId) {
  return this.findOne({ sumsubApplicantId: applicantId });
};

KYCSchema.statics.findPendingAdminReview = function () {
  return this.find({
    status: 'completed',
    'reviewResult.answer': 'GREEN',
    'adminReview.status': 'pending',
  });
};

const KYC = mongoose.model<IKYC>('KYC', KYCSchema);

export default KYC;
