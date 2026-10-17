import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { connectToDatabase, disconnectDatabase } from './db.js';
import { Engineer, Machine, User } from './models.js';

await connectToDatabase({ allowMemory: false });
const email = process.env.ADMIN_EMAIL || 'admin@example.com';
const existing = await User.findOne({ email });
if (!existing) {
  await User.create({
    name: process.env.ADMIN_NAME || 'System Administrator',
    email,
    passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeThisPassword123!', 12),
    role: 'admin'
  });
}
await Engineer.updateOne({ mobile: '9876543210' }, { $setOnInsert: { name: 'Aarav Mehta', mobile: '9876543210', active: true } }, { upsert: true });
if (await Machine.countDocuments() === 0) {
  await Machine.insertMany([
    { machineCode: 'NEXUS001ABC', qrUrl: `${config.publicUrl}/m/NEXUS001ABC`, status: 'generated', productType: 'Hydraulic Lift', model: 'NL-4000' },
    { machineCode: 'NEXUS002ABC', qrUrl: `${config.publicUrl}/m/NEXUS002ABC`, status: 'generated', productType: 'Wheel Aligner', model: 'WA-200' }
  ]);
}
console.info(`Seed complete. Admin login: ${email}. Engineer OTP in development: 123456.`);
await disconnectDatabase();
