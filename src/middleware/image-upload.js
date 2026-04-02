import fs from 'fs';

import { IncomingForm } from 'formidable';

import AWSController from '../services/AWS/AWS.service';

export const uploadImageMiddleware = async (req, res, next) => {
  try {
    const form = new IncomingForm({ multiples: true });

    // Parse the form data using promisify
    const [_fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    if (!files?.file || files?.file.length === 0) {
      throw new Error('No image file provided');
    }
    const file = files.file[0];

    if (!file.originalFilename || !file.filepath) {
      throw new Error('No image file provided');
    }

    const fileBuffer = await fs.promises.readFile(file.filepath);
    const fileExtension = file.originalFilename?.split('.').pop();
    const fileName = `${file.newFilename}.${fileExtension}`;
    // Upload the image to AWS S3
    const imageUrl = await AWSController.uploadImage(fileBuffer, fileName);

    // Attach the imageUrl to the request object
    req.uploadedImageUrl = imageUrl;

    // Continue to the next middleware/route handler
    next();
  } catch (error) {
    console.error('Error uploading image:', error);
    return next(new Error('Failed to upload image: ' + error.message));
  }
};

export default uploadImageMiddleware;
