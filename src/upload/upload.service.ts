import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_BYTES = 500 * 1024; // 500 KB

@Injectable()
export class UploadService {
  constructor(private config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadChatImage(
    file: Express.Multer.File,
    userId: string,
  ): Promise<{ url: string; publicId: string }> {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, GIF, and WEBP images are allowed');
    }

    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Image must be under 500 KB');
    }

    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    if (!apiKey || apiKey === 'your-api-key') {
      return {
        url: 'https://via.placeholder.com/500?text=Mocked+Upload',
        publicId: `mock_${Date.now()}`,
      };
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `chat-images/${userId}`,
          resource_type: 'image',
        },
        (error, result) => {
          if (error || !result) {
            reject(
              new InternalServerErrorException(
                `Image upload failed: ${error?.message || 'unknown error'}`,
              ),
            );
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  async deleteChatImage(publicId: string): Promise<void> {
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    if (!apiKey || apiKey === 'your-api-key') {
      return;
    }
    await cloudinary.uploader.destroy(publicId).catch(() => {});
  }
}
