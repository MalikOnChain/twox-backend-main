type KYCStatus = 'PENDING' | 'COMPLETED' | 'REJECTED' | 'EXPIRED' | string;

type AdminReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type VerificationLevel = 'basic-kyc' | 'advanced-kyc' | 'id-and-liveness' | 'phone-level';

type ReviewAnswer = 'GREEN' | 'RED' | 'YELLOW';

type RiskLevel = 'low' | 'medium' | 'high';

type ProofOfAddressType = 'utility_bill' | 'bank_statement' | 'tax_return' | 'other';

type AdditionalDocumentType = 'tax_id' | 'social_security' | 'other';

interface PersonalInfo {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  gender?: string;
  dateOfBirth?: Date;
  placeOfBirth?: string;
  nationality?: string;
  email?: string;
  phone?: string;
}

interface Address {
  country?: string;
  state?: string;
  city?: string;
  street?: string;
  postalCode?: string;
  residentialAddress?: string;
}

interface IdentityDocument {
  type?: string;
  country?: string;
  number?: string;
  issuedDate?: Date;
  validUntil?: Date;
  issueAuthority?: string;
  frontImagePath?: string;
  backImagePath?: string;
  selfieImagePath?: string;
}

interface ProofOfAddress {
  type?: ProofOfAddressType;
  issueDate?: Date;
  documentPath?: string;
}

interface AdditionalDocument {
  type: AdditionalDocumentType;
  number?: string;
  issuedDate?: Date;
  expiryDate?: Date;
  documentPath?: string;
  description?: string;
}

interface ReviewResult {
  answer?: ReviewAnswer;
  rejectLabels?: string[];
  moderationComment?: string;
  reviewerNotes?: string;
}

interface AdminReview {
  status: AdminReviewStatus;
  reviewedBy?: Mongoose.ObjectId;
  reviewedAt?: Date;
  notes?: string;
  rejectionReason?: string;
}

interface Metadata {
  applicantType?: string;
  clientId?: string;
  correlationId?: string;
  sandboxMode: boolean;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: any;
}

interface RiskAssessment {
  riskLevel?: RiskLevel;
  flags?: string[];
  score?: number;
  notes?: string;
}

interface IKYC extends Mongoose.Document {
  userId: string;
  sumsubApplicantId?: string;
  sumsubInspectionId?: string;
  status: KYCStatus;
  personalInfo: PersonalInfo;
  address: Address;
  identityDocument: IdentityDocument;
  proofOfAddress?: ProofOfAddress;
  additionalDocuments: AdditionalDocument[];
  verificationLevel: VerificationLevel;
  reviewResult?: ReviewResult;
  adminReview: AdminReview;
  metadata: Metadata;
  riskAssessment?: RiskAssessment;
  attempts: number;
  lastAttemptAt?: Date;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Methods
  isVerified(): boolean;
  updateFromWebhook(webhookData: any): Promise<IKYC>;
  updateDocumentPaths(paths: any): Promise<IKYC>;
}

// Static methods interface
interface IKYCModel {
  findByApplicantId(applicantId: string): Promise<IKYC | null>;
  findPendingAdminReview(): Promise<IKYC[]>;
}
