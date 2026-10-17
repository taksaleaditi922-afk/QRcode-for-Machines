import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { Engineer, Machine, User } from './models.js';

let memoryServer;

async function seedMemoryDatabase() {
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  await User.updateOne({ email }, {
    $setOnInsert: {
      name: process.env.ADMIN_NAME || 'System Administrator',
      email,
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeThisPassword123!', 12),
      role: 'admin'
    }
  }, { upsert: true });
  await Engineer.updateOne({ mobile: '9876543210' }, {
    $setOnInsert: { name: 'Aarav Mehta', mobile: '9876543210', active: true }
  }, { upsert: true });
  await Machine.updateOne({ machineCode: 'NEXUS001ABC' }, {
    $setOnInsert: {
      machineCode: 'NEXUS001ABC',
      qrUrl: `${config.publicUrl}/m/NEXUS001ABC`,
      status: 'generated',
      productType: 'Hydraulic Lift',
      model: 'NL-4000'
    }
  }, { upsert: true });
  await Machine.updateOne({ machineCode: 'NEXUS002ABC' }, {
    $setOnInsert: {
      machineCode: 'NEXUS002ABC',
      qrUrl: `${config.publicUrl}/m/NEXUS002ABC`,
      status: 'generated',
      productType: 'Wheel Aligner',
      model: 'WA-200'
    }
  }, { upsert: true });
}

export async function connectToDatabase({ allowMemory = true } = {}) {
  const uri = config.mongoUri;

  try {
    await mongoose.connect(uri);
    return { uri, memoryServer: null };
  } catch (error) {
    if (process.env.NODE_ENV === 'production' || process.env.MONGODB_URI || !allowMemory) {
      throw error;
    }

    memoryServer = await MongoMemoryServer.create();
    const memoryUri = memoryServer.getUri();
    config.mongoUri = memoryUri;
    await mongoose.connect(memoryUri);
    console.info('MongoDB connection failed, so the app started an in-memory MongoDB instance for local development.');
    await seedMemoryDatabase();
    return { uri: memoryUri, memoryServer };
  }
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
