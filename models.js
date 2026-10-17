import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema, model } = mongoose;
const photoSchema = new Schema({ filename: String, url: String }, { _id: false });
const machineSchema = new Schema({
  machineCode: { type: String, unique: true, required: true, index: true },
  qrUrl: String,
  status: { type: String, enum: ['generated', 'installed', 'registered'], default: 'generated', index: true },
  productType: String, model: String, serialNumber: { type: String, index: true }
}, { timestamps: true });
machineSchema.index({ createdAt: -1 });
const installationSchema = new Schema({
  machine: { type: Schema.Types.ObjectId, ref: 'Machine', required: true, unique: true },
  engineer: { type: Schema.Types.ObjectId, ref: 'Engineer' },
  engineerName: String,
  installationDate: { type: Date, required: true },
  siteAddress: { type: String, required: true },
  location: { latitude: Number, longitude: Number },
  customerName: { type: String, required: true },
  customerMobile: { type: String, required: true, index: true },
  serialNumber: { type: String, required: true, index: true },
  model: String, productType: { type: String, required: true },
  commissioningNotes: String, photos: [photoSchema],
  checklist: [{ label: String, complete: Boolean }]
}, { timestamps: true });
const customerSchema = new Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true, index: true },
  email: String, address: String, machine: { type: Schema.Types.ObjectId, ref: 'Machine', required: true, unique: true },
  serialNumber: { type: String, required: true }, model: String, productType: String, purchaseDate: Date, dealer: String
}, { timestamps: true });
const ticketSchema = new Schema({
  ticketNumber: { type: String, unique: true, index: true },
  machine: { type: Schema.Types.ObjectId, ref: 'Machine', required: true, index: true },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  machineType: String,
  issueCategory: { type: String, required: true, enum: ['Error code', 'Not starting', 'Noise', 'Performance', 'Other'] },
  description: { type: String, required: true },
  errorCode: String, photos: [photoSchema],
  priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  status: { type: String, enum: ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'], default: 'Open', index: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  assignedEngineer: { type: Schema.Types.ObjectId, ref: 'Engineer', index: true },
  statusHistory: [{ status: String, note: String, changedBy: String, at: { type: Date, default: Date.now } }],
  auditTrail: [{ action: String, message: String, changedBy: String, at: { type: Date, default: Date.now } }],
  resolutionNotes: String,
  idempotencyKey: { type: String, unique: true, sparse: true }
}, { timestamps: true });
ticketSchema.index({ createdAt: -1 });
const engineerSchema = new Schema({ name: { type: String, required: true }, mobile: { type: String, required: true, unique: true }, active: { type: Boolean, default: true } }, { timestamps: true });
const userSchema = new Schema({
  name: { type: String, required: true }, email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true }, role: { type: String, enum: ['admin', 'service'], default: 'service' }
}, { timestamps: true });
const otpSchema = new Schema({
  mobile: { type: String, required: true },
  purpose: { type: String, required: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
  attempts: { type: Number, default: 0 }
});
userSchema.methods.comparePassword = function comparePassword(password) { return bcrypt.compare(password, this.passwordHash); };
userSchema.statics.hashPassword = (password) => bcrypt.hash(password, 12);

export const Machine = model('Machine', machineSchema);
export const Installation = model('Installation', installationSchema);
export const Customer = model('Customer', customerSchema);
export const Ticket = model('Ticket', ticketSchema);
export const Engineer = model('Engineer', engineerSchema);
export const User = model('User', userSchema);
export const OtpChallenge = model('OtpChallenge', otpSchema);
