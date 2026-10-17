import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') });

export const config = {
  companyName: process.env.COMPANY_NAME || 'Ve R Mobility Solutions',
  port: Number(process.env.PORT || 4001),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/qr-machine-care',
  jwtSecret: process.env.JWT_SECRET || 'development-secret-change-me',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  publicUrl: process.env.PUBLIC_APP_URL || process.env.CLIENT_URL || 'http://localhost:5173',
  backOfficeEmails: (process.env.BACK_OFFICE_EMAILS || '').split(',').map((email) => email.trim()).filter(Boolean)
};

if (process.env.NODE_ENV === 'production') {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be configured in production.');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /replace|change.?me|development/i.test(process.env.JWT_SECRET)) {
    throw new Error('Set JWT_SECRET to a unique random value of at least 32 characters in production.');
  }
}
