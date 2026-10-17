import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { connectToDatabase } from './db.js';
import router from './routes.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.clientUrl.split(',').map((url) => url.trim()), credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(fileURLToPath(new URL('../uploads', import.meta.url)), { maxAge: '7d', immutable: true, dotfiles: 'deny' }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => console.info(JSON.stringify({ level: 'info', method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - start })));
  next();
});
app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/engineer/otp', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/customer/otp', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/customer/access/otp', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false }));
app.use('/api/tickets', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.use('/api', router);
app.use((req, res) => res.status(404).json({ message: 'The requested API route was not found.' }));
app.use((error, _req, res, _next) => {
  console.error(JSON.stringify({ level: 'error', message: error.message, name: error.name }));
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'The image is too large. Choose an image under 5 MB.' });
  if (error.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ message: 'Upload one image at a time.' });
  if (error.code === 11000) return res.status(409).json({ message: 'This record already exists.' });
  if (error.name === 'ValidationError') return res.status(422).json({ message: error.message });
  res.status(error.status || 500).json({ message: process.env.NODE_ENV === 'production' ? 'Something went wrong. Please try again.' : error.message });
});

await connectToDatabase();
app.listen(config.port, () => console.info(`${config.companyName} API listening on port ${config.port}`));
