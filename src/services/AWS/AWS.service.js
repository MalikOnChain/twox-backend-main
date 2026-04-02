import { Buffer } from 'buffer';

import { S3 } from '@aws-sdk/client-s3';

import { logger } from '@/utils/logger/index.js';

class AWSController {
  constructor() {
    // Configure AWS SDK
    this.s3 = new S3({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.bucketName = process.env.AWS_BUCKET_NAME || 'bitstake.images';
  }

  async uploadBase64Image(imageData, fileName) {
    const params = {
      Bucket: this.bucketName,
      Key: fileName,
      Body: Buffer.from(imageData, 'base64'),
      ContentType: 'image/jpeg',
    };

    const result = await this.s3.putObject(params);

    logger.info('Uploaded image:', result);

    return `${process.env.IMAGE_STORE_URL}/${fileName}`;
  }

  async uploadImage(imageData, fileName) {
    const params = {
      Bucket: this.bucketName,
      Key: fileName,
      Body: imageData,
    };

    const result = await this.s3.putObject(params);

    logger.info('Uploaded image:', result);

    return `${process.env.IMAGE_STORE_URL}/${fileName}`;
  }

  async getImage(fileName) {
    const params = {
      Bucket: this.bucketName,
      Key: fileName,
    };

    try {
      const result = await this.s3.getObject(params);
      return result.Body;
    } catch (error) {
      if (error.code === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  async deleteImage(fileName) {
    const params = {
      Bucket: this.bucketName,
      Key: fileName,
    };

    try {
      await this.s3.deleteObject(params);
      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  }

  getImageUrl(fileName) {
    return `${process.env.IMAGE_STORE_URL}/${fileName}`;
  }

  async validateAWSConnection() {
    const params = {
      Bucket: this.bucketName,
    };

    try {
      await this.s3.headBucket(params);
      return true;
    } catch (error) {
      console.error('Error validating AWS connection:', error);
      throw error;
    }
  }
}

export default new AWSController();
