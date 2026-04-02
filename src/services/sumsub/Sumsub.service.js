import crypto from 'crypto';

import axios from 'axios';

import KYC from '@/models/users/KYC';
import { logger } from '@/utils/logger';

export class SumsubService {
  constructor() {
    this.appToken = 'sbx:6elCtyTccdy3UBxqNre5Q4u9.a5ouSNJ1fZitXu8QLI9jGGwpngBFWppE';
    this.secretKey = 'tHZeBZXtwVrhEf3xenmqpiGHjCE4Zqvu';
    this.baseUrl = 'https://api.sumsub.com';
  }

  async webhookHandler(req, res) {
    try {
      const {
        type,
        reviewStatus,
        applicantId,
        externalUserId,
        reviewResult,
        levelName,
        inspectionId,
        correlationId,
        clientId,
        applicantType,
      } = req.body;

      logger.debug('Received Sumsub Webhook:', req.body);

      switch (type) {
        case 'applicantCreated': {
          await this.onApplicantCreated(
            applicantId,
            externalUserId,
            inspectionId,
            correlationId,
            levelName,
            applicantType,
            clientId
          );
          logger.info(`New KYC record created for applicant: ${applicantId} (${externalUserId})`);
          break;
        }

        case 'applicantReviewed': {
          await this.onApplicantReviewed(applicantId, type, reviewStatus, reviewResult);
          logger.info(`Updated KYC status and documents for user ${externalUserId}: ${reviewStatus}`);
          res.sendStatus(200);
          break;
        }

        case 'applicantPending': {
          logger.info(`User ${applicantId} (${externalUserId}) requires additional documents for level: ${levelName}`);
          break;
        }

        case 'applicantOnHold': {
          logger.info(`User ${applicantId} (${externalUserId}) verification is on hold`);
          break;
        }

        case 'applicantDeleted': {
          logger.info(`Applicant deleted: ${applicantId} (${externalUserId})`);
          const kyc = await KYC.findByApplicantId(applicantId);
          if (kyc) {
            await kyc.delete();
          } else {
            logger.error(`No KYC record found for applicant: ${applicantId}`);
          }
          break;
        }

        default:
          logger.info(`Unhandled webhook type: ${type}`);
      }

      res.sendStatus(200);
    } catch (error) {
      logger.error('Error processing Sumsub webhook:', error);
      res.sendStatus(500);
    }
  }

  async onApplicantCreated(
    applicantId,
    externalUserId,
    inspectionId,
    correlationId,
    levelName,
    applicantType,
    clientId
  ) {
    const newKyc = new KYC({
      userId: externalUserId,
      sumsubApplicantId: applicantId,
      sumsubInspectionId: inspectionId,
      verificationLevel: levelName,
      metadata: {
        applicantType: applicantType,
        clientId: clientId,
        correlationId: correlationId,
        sandboxMode: true,
      },
      status: 'init',
    });

    await newKyc.save();
  }

  async onApplicantReviewed(applicantId, type, reviewStatus, reviewResult) {
    const kyc = await KYC.findByApplicantId(applicantId);
    if (!kyc) {
      logger.error(`No KYC record found for applicant: ${applicantId}`);
      return null;
    }

    const applicantDetails = await this.sumsubService.getApplicantDetails(applicantId);
    logger.info('Applicant details:', applicantDetails.info.idDocs);

    const identityDocument = applicantDetails.info.idDocs.map((doc) => ({
      type: doc.idDocType,
      country: doc.country,
      number: doc.number,
      issuedDate: doc.issuedDate,
      validUntil: doc.validUntil,
      issueAuthority: doc.issueAuthority,
    }));

    kyc.identityDocument = identityDocument[0];

    kyc.personalInfo = {
      firstName: applicantDetails.info.firstName,
      lastName: applicantDetails.info.lastName,
      dateOfBirth: applicantDetails.info.dob,
      gender: applicantDetails.info.gender,
      country: applicantDetails.info.country,
      email: applicantDetails.email,
    };
    await kyc.save();

    const requiredIdDocsStatus = await this.sumsubService.getApplicantRequiredIdDocsStatus(applicantId);
    const identity = await this.sumsubService.getImages(applicantId, requiredIdDocsStatus.identity, applicantId);
    const documentPaths = await this.processDocumentPaths(identity);

    // Update KYC with document paths and review result
    await kyc.updateDocumentPaths(documentPaths);
    await kyc.updateFromWebhook({
      type,
      reviewStatus,
      reviewResult: {
        reviewAnswer: reviewResult?.reviewAnswer,
        rejectLabels: reviewResult?.rejectLabels,
        moderationComment: reviewResult?.moderationComment,
      },
    });

    await this.customerIO.updateCustomer(kyc.userId, {
      firstName: applicantDetails.info.firstName,
      lastName: applicantDetails.info.lastName,
      email: applicantDetails.email,
      sumsub_review_answer: reviewResult?.reviewAnswer,
      sumsub_review_reject_labels: reviewResult?.rejectLabels,
      sumsub_review_moderation_comment: reviewResult?.moderationComment,
      phone_number: applicantDetails.phone,
      date_of_birth: applicantDetails.info.dob,
      gender: applicantDetails.info.gender,
      country: applicantDetails.info.country,
    });
  }

  async processDocumentPaths(identity) {
    const paths = {};

    try {
      for (const image of identity.images) {
        // Skip if no base64Image
        if (!image.base64Image) {
          logger.warn(`No base64Image found for image ID: ${image.id}`);
          continue;
        }

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `kyc/${identity.documentType}_${image.id}_${timestamp}.${image.mimeType.split('/')[1]}`;

        // Upload to AWS
        const filePath = await this.awsController.uploadBase64Image(image.base64Image, filename);

        // Store the S3 URL based on document type and side
        if (
          identity.documentType === 'PASSPORT' ||
          identity.documentType === 'ID_CARD' ||
          identity.documentType === 'DRIVERS_LICENSE'
        ) {
          // For ID documents, we need to determine front/back
          // First image is typically front, second is back
          if (!paths.frontImage) {
            paths.frontImage = filePath;
          } else {
            paths.backImage = filePath;
          }
        } else if (identity.documentType === 'SELFIE') {
          paths.selfieImage = filePath;
        } else if (identity.documentType === 'PROOF_OF_RESIDENCE') {
          paths.proofOfAddress = filePath;
        }
      }

      return paths;
    } catch (error) {
      logger.error('Error processing document paths:', error);
      throw error;
    }
  }

  generateSignature(timestamp, method = '', url = '', body = '') {
    const dataToSign = `${timestamp}${method.toUpperCase()}${url}${body}`;
    return crypto
      .createHmac('sha256', Buffer.from(this.secretKey, 'utf-8'))
      .update(Buffer.from(dataToSign, 'utf-8'))
      .digest('hex');
  }

  getHeaders(timestamp, method, url, body = '') {
    return {
      'Content-Type': 'application/json',
      'X-App-Token': this.appToken,
      'X-App-Access-Ts': timestamp,
      'X-App-Access-Sig': this.generateSignature(timestamp, method, url, body),
    };
  }

  async createApplicantByAPI(userId, email) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const levelName = encodeURIComponent('basic-kyc');
    const url = `/resources/applicants?levelName=${levelName}`;
    const requestBody = JSON.stringify({
      externalUserId: userId,
      email: email,
    });

    try {
      const response = await axios.post(`${this.baseUrl}${url}`, requestBody, {
        headers: this.getHeaders(timestamp, 'POST', url, requestBody),
      });

      logger.info('Applicant created:', response.data);

      return response.data;
    } catch (error) {
      logger.error('Error creating applicant:', error.response?.data || error.message);
      throw error;
    }
  }

  async createOrGetApplicantByAPI(userId, email) {
    try {
      // First, try to get existing applicant
      const existingApplicant = await this.getApplicantByExternalId(userId);

      logger.info('Existing applicant:', existingApplicant);

      if (existingApplicant) {
        logger.info('Using existing applicant:', {
          id: existingApplicant.id,
          externalUserId: existingApplicant.externalUserId,
          status: existingApplicant.review?.reviewStatus,
        });
        return existingApplicant;
      }

      logger.info('Creating new applicant for:', { userId, email });
      const newApplicant = await this.createApplicant(userId, email);
      logger.info('Created new applicant:', {
        id: newApplicant.id,
        externalUserId: newApplicant.externalUserId,
        status: newApplicant.review?.reviewStatus,
      });
      return newApplicant;
    } catch (error) {
      logger.error('Error in createOrGetApplicant:', {
        error: error.response?.data || error.message,
        userId,
        email,
      });
      throw error;
    }
  }

  async generateKYCLinkByAPI(applicantId) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const url = '/resources/accessTokens/sdk';
    const requestBody = JSON.stringify({
      userId: applicantId,
      levelName: 'basic-kyc',
      ttlInSecs: 600,
    });

    try {
      const response = await axios.post(`${this.baseUrl}${url}`, requestBody, {
        headers: this.getHeaders(timestamp, 'POST', url, requestBody),
      });
      logger.info('Access token generated:', response.data);
      return response.data.token;
    } catch (error) {
      logger.error('Error generating KYC access token:', error.response?.data || error.message);
      throw error;
    }
  }

  async getApplicantByExternalId(externalUserId) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const url = `/resources/applicants/-;externalUserId=${externalUserId}`;

    try {
      const response = await axios.get(`${this.baseUrl}${url}`, {
        headers: this.getHeaders(timestamp, 'GET', url),
      });

      // Extract the first applicant from the list
      const applicant = response.data.list?.items?.[0];

      if (!applicant) {
        logger.info(`No applicant found for externalUserId: ${externalUserId}`);
        return null;
      }

      logger.info('Found applicant:', {
        id: applicant.id,
        externalUserId: applicant.externalUserId,
        status: applicant.review?.reviewStatus,
      });

      return applicant;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Error getting applicant by external ID:', error.response?.data || error.message);
      throw error;
    }
  }

  async getSumsubAPIAccessToken(userId, email) {
    const applicant = await this.createOrGetApplicantByAPI(userId, email);
    const accessToken = await this.generateKYCLinkByAPI(applicant.id);
    return accessToken;
  }

  async getSumsubSDKAccessToken(userId, email) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const url = '/resources/accessTokens/sdk';
    const levelName = encodeURIComponent('basic-kyc');
    const requestBody = JSON.stringify({
      applicantIdentifiers: {
        email: email,
      },
      ttlInSecs: 600,
      userId: userId,
      levelName,
    });

    try {
      const response = await axios.post(`${this.baseUrl}${url}`, requestBody, {
        headers: this.getHeaders(timestamp, 'POST', url, requestBody),
      });
      logger.info('Access token generated:', response.data);
      return response.data;
    } catch (error) {
      logger.error('Error generating KYC access token:', error.response?.data || error.message);
      throw error;
    }
  }

  async isUserVerified(userId) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const url = `/resources/applicants/-;externalUserId=${userId}/status`;

    try {
      const response = await axios.get(`${this.baseUrl}${url}`, { headers: this.getHeaders(timestamp, 'GET', url) });
      return response.data.reviewStatus === 'completed';
    } catch (error) {
      logger.error('Error checking user verification status:', error.response?.data || error.message);
      return false;
    }
  }

  async getApplicantDetails(applicantId) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const url = `/resources/applicants/${applicantId}/one`;

    logger.info('Getting applicant details:', `${this.baseUrl}${url}`);

    try {
      const response = await axios.get(`${this.baseUrl}${url}`, {
        headers: this.getHeaders(timestamp, 'GET', url),
      });
      return response.data;
    } catch (error) {
      logger.error('Error getting applicant details:', error.response?.data || error.message);
      throw error;
    }
  }

  async getApplicantRequiredIdDocsStatus(applicantId) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const url = `/resources/applicants/${applicantId}/requiredIdDocsStatus`;

    try {
      const response = await axios.get(`${this.baseUrl}${url}`, {
        headers: this.getHeaders(timestamp, 'GET', url),
      });

      const result = {
        identity: null,
        emailVerification: null,
      };

      // Process IDENTITY data if it exists
      if (response.data.IDENTITY) {
        const identity = response.data.IDENTITY;
        result.identity = {
          status: identity.reviewResult?.reviewAnswer || 'PENDING',
          country: identity.country,
          documentType: identity.idDocType,
          isForbidden: identity.forbidden || false,
          images: identity.imageIds.map((imageId) => ({
            id: imageId,
            status: identity.imageReviewResults[imageId]?.reviewAnswer || 'PENDING',
          })),
        };
      }

      // Process EMAIL_VERIFICATION data if it exists
      if (response.data.EMAIL_VERIFICATION) {
        result.emailVerification = {
          status: response.data.EMAIL_VERIFICATION.reviewResult?.reviewAnswer || 'PENDING',
        };
      }

      logger.info('Applicant document status:', result);
      return result;
    } catch (error) {
      logger.error('Error getting applicant required ID docs status:', error.response?.data || error.message);
      throw error;
    }
  }

  async getImages(applicantId, identity, inspectionId) {
    for (const image of identity.images) {
      const imageId = image.id;
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const url = `/resources/inspections/${inspectionId}/resources/${imageId}`;

      logger.info('Getting image:', `${this.baseUrl}${url}`);

      try {
        const response = await axios.get(`${this.baseUrl}${url}`, {
          headers: this.getHeaders(timestamp, 'GET', url),
          responseType: 'arraybuffer',
        });

        // Convert array buffer to base64
        const base64Image = Buffer.from(response.data, 'binary').toString('base64');

        image.base64Image = base64Image;
        image.mimeType = response.headers['content-type'] || 'image/jpeg';
      } catch (error) {
        logger.error('Error getting image:', {
          applicantId,
          imageId,
          error: error.response?.data ? error.response.data.toString() : error.message,
        });

        // Continue with other images even if one fails
        continue;
      }
    }

    return identity;
  }

  async validateSumsubConnection() {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const url = '/resources/status/api';

    await axios.get(`${this.baseUrl}${url}`, {
      headers: this.getHeaders(timestamp, 'GET', url),
    });
  }
}

export default new SumsubService();
