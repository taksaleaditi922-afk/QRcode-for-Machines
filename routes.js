import { Router } from 'express';
import { body, param } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import ExcelJS from 'exceljs';
import archiver from 'archiver';
import PDFDocument from 'pdfkit';
import multer from 'multer';
import { mkdirSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { Machine, Installation, Customer, Ticket, Engineer, User } from './models.js';
import { config } from './config.js';
import { allowRoles, asyncHandler, authenticate, pageQuery, validate } from './middleware.js';
import { createOtpChallenge, notifyBackOffice, notifyEngineerAssignment, sendCustomerConfirmation, verifyOtpChallenge } from './services.js';

const router = Router();
const publicLink = (machineCode) => `${config.publicUrl}/m/${machineCode}`;
const tokenFor = (payload, expiresIn = '8h') => jwt.sign(payload, config.jwtSecret, { expiresIn });
const cleanCode = () => randomBytes(8).toString('hex').toUpperCase();
const searchRegex = (value) => new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
async function relatedSearchIds(expression) {
  const [machines, customers] = await Promise.all([
    Machine.distinct('_id', { machineCode: expression }),
    Customer.distinct('_id', { $or: [{ name: expression }, { mobile: expression }] })
  ]);
  return { machines, customers };
}
const formatIST = (value) => value ? new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
}).format(new Date(value)) : '';
const checklistDefaults = ['Machine mounted securely', 'Electrical connections checked', 'Safety guards verified', 'Test run completed'];
const uploadDir = join(dirname(fileURLToPath(import.meta.url)), '../uploads');
mkdirSync(uploadDir, { recursive: true });
const imageExtensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, callback) => callback(null, `${randomBytes(16).toString('hex')}${imageExtensions[file.mimetype] || '.img'}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, Boolean(imageExtensions[file.mimetype]))
});

function allowImageUpload(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const payload = jwt.verify(token || '', config.jwtSecret);
    if (!['admin', 'service', 'engineer', 'machine-customer'].includes(payload.role)) {
      return res.status(403).json({ message: 'You do not have permission to upload photos.' });
    }
    next();
  } catch {
    return res.status(401).json({ message: 'Sign in or register this machine before uploading photos.' });
  }
}

router.post('/uploads', allowImageUpload, imageUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(422).json({ message: 'Choose a JPEG, PNG, or WebP image to upload.' });
  const content = await readFile(req.file.path);
  const validImage = req.file.mimetype === 'image/jpeg'
    ? content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff
    : req.file.mimetype === 'image/png'
      ? content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : content.toString('ascii', 0, 4) === 'RIFF' && content.toString('ascii', 8, 12) === 'WEBP';
  if (!validImage) {
    await unlink(req.file.path);
    return res.status(422).json({ message: 'The uploaded file is not a valid JPEG, PNG, or WebP image.' });
  }
  res.status(201).json({ filename: req.file.filename, url: `/uploads/${req.file.filename}` });
}));

router.post('/auth/login', [body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 1 }), validate], asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user || !(await user.comparePassword(req.body.password))) return res.status(401).json({ message: 'Email or password is incorrect.' });
  res.json({ token: tokenFor({ id: user.id, role: user.role, name: user.name }), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

router.post('/auth/engineer/otp', [body('mobile').matches(/^\+?[0-9\s-]{10,16}$/), validate], asyncHandler(async (req, res) => {
  const mobile = req.body.mobile.replace(/\D/g, '');
  const engineer = await Engineer.findOne({ mobile, active: true });
  if (!engineer) return res.status(403).json({ message: 'This mobile number is not on the active engineer list.' });
  const code = await createOtpChallenge(mobile, 'engineer');
  res.json({ message: 'Verification code sent.', ...code });
}));
router.post('/auth/engineer/verify', [
  body('mobile').matches(/^\+?[0-9\s-]{10,16}$/), body('otp').isLength({ min: 6, max: 6 }), validate
], asyncHandler(async (req, res) => {
  const mobile = req.body.mobile.replace(/\D/g, '');
  if (!(await verifyOtpChallenge(mobile, 'engineer', req.body.otp))) return res.status(401).json({ message: 'The verification code is invalid or expired.' });
  const engineer = await Engineer.findOne({ mobile, active: true });
  if (!engineer) return res.status(403).json({ message: 'Engineer is not active.' });
  res.json({ token: tokenFor({ id: engineer.id, role: 'engineer', name: engineer.name }), user: { id: engineer.id, name: engineer.name, role: 'engineer' } });
}));

router.post('/auth/customer/otp', [body('mobile').matches(/^\+?[0-9\s-]{10,16}$/), validate], asyncHandler(async (req, res) => {
  const mobile = req.body.mobile.replace(/\D/g, '');
  const result = await createOtpChallenge(mobile, 'customer-registration');
  res.json({ message: 'Verification code sent.', ...result });
}));
router.post('/auth/customer/verify', [body('mobile').matches(/^\+?[0-9\s-]{10,16}$/), body('otp').isLength({ min: 6, max: 6 }), validate], asyncHandler(async (req, res) => {
  const mobile = req.body.mobile.replace(/\D/g, '');
  if (!(await verifyOtpChallenge(mobile, 'customer-registration', req.body.otp))) return res.status(401).json({ message: 'The verification code is invalid or expired.' });
  res.json({ verificationToken: tokenFor({ mobile, role: 'verified-customer' }, '20m') });
}));

router.post('/auth/customer/access/otp', [
  body('machineCode').isAlphanumeric(), body('mobile').matches(/^\+?[0-9\s-]{10,16}$/), validate
], asyncHandler(async (req, res) => {
  const mobile = req.body.mobile.replace(/\D/g, '');
  const machine = await Machine.findOne({ machineCode: req.body.machineCode.toUpperCase(), status: 'registered' }).select('_id').lean();
  if (!machine || !(await Customer.exists({ machine: machine._id, mobile }))) {
    return res.status(403).json({ message: 'This mobile number is not registered to this machine.' });
  }
  const result = await createOtpChallenge(mobile, `customer-access:${machine._id}`);
  res.json({ message: 'Verification code sent.', ...result });
}));

router.post('/auth/customer/access/verify', [
  body('machineCode').isAlphanumeric(), body('mobile').matches(/^\+?[0-9\s-]{10,16}$/), body('otp').isLength({ min: 6, max: 6 }), validate
], asyncHandler(async (req, res) => {
  const mobile = req.body.mobile.replace(/\D/g, '');
  const machine = await Machine.findOne({ machineCode: req.body.machineCode.toUpperCase(), status: 'registered' }).select('_id').lean();
  if (!machine || !(await verifyOtpChallenge(mobile, `customer-access:${machine._id}`, req.body.otp))) {
    return res.status(401).json({ message: 'The verification code is invalid or expired.' });
  }
  if (!(await Customer.exists({ machine: machine._id, mobile }))) {
    return res.status(403).json({ message: 'This mobile number is not registered to this machine.' });
  }
  res.json({ customerToken: tokenFor({ machine: machine._id, role: 'machine-customer' }, '30d') });
}));

router.get('/machines/lookup/:machineCode', [param('machineCode').isAlphanumeric(), validate], asyncHandler(async (req, res) => {
  const machine = await Machine.findOne({ machineCode: req.params.machineCode.toUpperCase() }).select('machineCode status productType model serialNumber').lean();
  if (!machine) return res.status(404).json({ message: 'We could not find this machine. Please check the QR code or contact support.' });
  const installation = await Installation.findOne({ machine: machine._id }).select('serialNumber').lean();
  const customerToken = machine.status === 'registered'
    ? tokenFor({ machine: machine._id, role: 'machine-customer' }, '30d')
    : null;
  res.json({ machine, installation, customerToken });
}));

router.post('/machines/generate', authenticate, allowRoles('admin'), [body('quantity').isInt({ min: 1, max: 500 }), validate], asyncHandler(async (req, res) => {
  const quantity = Number(req.body.quantity);
  const machines = [];
  for (let i = 0; i < quantity; i += 1) {
    const machineCode = cleanCode();
    const qrUrl = publicLink(machineCode);
    machines.push({ machineCode, qrUrl, productType: req.body.productType || '', model: req.body.model || '' });
  }
  const created = await Machine.insertMany(machines);
  res.status(201).json({ machines: created.map((machine) => ({ id: machine.id, machineCode: machine.machineCode, qrUrl: machine.qrUrl })) });
}));

router.get('/machines', authenticate, allowRoles('admin', 'service'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageQuery(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const expression = searchRegex(req.query.search);
    filter.$or = [{ machineCode: expression }, { productType: expression }, { model: expression }, { serialNumber: expression }];
  }
  const [items, total] = await Promise.all([Machine.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Machine.countDocuments(filter)]);
  res.json({ items, page, limit, total });
}));

router.post('/installations', authenticate, [body('machineCode').isAlphanumeric(), body('serialNumber').trim().notEmpty(), body('customerName').trim().notEmpty(), body('customerMobile').matches(/^\+?[0-9\s-]{10,16}$/), body('siteAddress').trim().notEmpty(), body('productType').trim().notEmpty(), body('photos').isArray({ min: 1 }), body('photos.*.url').isString().notEmpty(), validate], asyncHandler(async (req, res) => {
  const machine = await Machine.findOne({ machineCode: req.body.machineCode.toUpperCase() });
  if (!machine) return res.status(404).json({ message: 'Machine not found.' });
  if (machine.status !== 'generated') return res.status(409).json({ message: 'Installation has already been recorded for this machine.' });
  const installation = await Installation.create({
    machine: machine._id, engineer: req.user.role === 'engineer' ? req.user.id : undefined, engineerName: req.user.name,
    installationDate: req.body.installationDate || new Date(), siteAddress: req.body.siteAddress, location: req.body.location,
    customerName: req.body.customerName, customerMobile: req.body.customerMobile.replace(/\D/g, ''),
    serialNumber: req.body.serialNumber, model: req.body.model, productType: req.body.productType,
    commissioningNotes: req.body.commissioningNotes, checklist: req.body.checklist || checklistDefaults.map((label) => ({ label, complete: true })),
    photos: req.body.photos || []
  });
  machine.status = 'installed'; machine.serialNumber = installation.serialNumber; machine.model = installation.model; machine.productType = installation.productType;
  await machine.save();
  await notifyBackOffice('Machine installation recorded', `${machine.machineCode} was installed by ${req.user.name}.`);
  res.status(201).json({ installation, reference: `INS-${installation.id.slice(-8).toUpperCase()}` });
}));

router.get('/installations', authenticate, allowRoles('admin', 'service'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageQuery(req);
  const filter = {};
  if (req.query.search) {
    const expression = searchRegex(req.query.search);
    const matchingMachines = await Machine.distinct('_id', { machineCode: expression });
    filter.$or = [{ customerName: expression }, { serialNumber: expression }, { engineerName: expression }, { machine: { $in: matchingMachines } }];
  }
  const [items, total] = await Promise.all([
    Installation.find(filter).populate('machine', 'machineCode').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Installation.countDocuments(filter)
  ]);
  res.json({ items, page, limit, total });
}));

router.get('/customers', authenticate, allowRoles('admin', 'service'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageQuery(req);
  const filter = {};
  if (req.query.search) {
    const expression = searchRegex(req.query.search);
    const matchingMachines = await Machine.distinct('_id', { machineCode: expression });
    filter.$or = [{ name: expression }, { mobile: expression }, { serialNumber: expression }, { machine: { $in: matchingMachines } }];
  }
  const [items, total] = await Promise.all([Customer.find(filter).populate('machine', 'machineCode').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Customer.countDocuments(filter)]);
  res.json({ items, page, limit, total });
}));

router.post('/customers/register', [body('machineCode').isAlphanumeric(), body('name').trim().notEmpty(), body('mobile').matches(/^\+?[0-9\s-]{10,16}$/), body('serialNumber').trim().notEmpty(), validate], asyncHandler(async (req, res) => {
  const machine = await Machine.findOne({ machineCode: req.body.machineCode.toUpperCase() });
  if (!machine) return res.status(404).json({ message: 'Machine not found.' });
  if (machine.status === 'generated') return res.status(409).json({ message: 'Please complete the machine installation before registration.' });
  if (machine.status === 'registered') return res.status(409).json({ message: 'This machine is already registered.' });
  const installation = await Installation.findOne({ machine: machine._id });
  if (installation && installation.serialNumber !== req.body.serialNumber) return res.status(422).json({ message: 'Serial number does not match the installation record.' });
  const customer = await Customer.create({
    machine: machine._id, name: req.body.name.trim(), mobile: req.body.mobile.replace(/\D/g, ''),
    serialNumber: req.body.serialNumber, model: req.body.model || machine.model, productType: req.body.productType || machine.productType,
    email: req.body.email, address: req.body.address, purchaseDate: req.body.purchaseDate || undefined, dealer: req.body.dealer
  });
  machine.status = 'registered'; await machine.save();
  await notifyBackOffice('Customer registration completed', `${customer.name} registered machine ${machine.machineCode}.`);
  res.status(201).json({ customer: { name: customer.name, machineCode: machine.machineCode }, customerToken: tokenFor({ machine: machine._id, role: 'machine-customer' }, '30d') });
}));

function customerMachine(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  try {
    const payload = jwt.verify(token || '', config.jwtSecret);
    if (payload.role !== 'machine-customer') throw new Error('Invalid role');
    req.customerMachine = payload.machine;
    return next();
  } catch {
    return res.status(401).json({ message: 'Please register this machine to view its service history.' });
  }
}

router.post('/tickets', customerMachine, [
  body('issueCategory').isIn(['Error code', 'Not starting', 'Noise', 'Performance', 'Other']),
  body('description').trim().isLength({ min: 5, max: 3000 }), validate
], asyncHandler(async (req, res) => {
  if (String(req.body.machineId) !== String(req.customerMachine)) return res.status(403).json({ message: 'This session cannot create a ticket for another machine.' });
  const machine = await Machine.findById(req.customerMachine);
  const customer = await Customer.findOne({ machine: machine._id });
  if (!customer) return res.status(404).json({ message: 'Customer registration not found.' });
  const idempotencyKey = req.get('Idempotency-Key');
  if (idempotencyKey) {
    const existingTicket = await Ticket.findOne({ idempotencyKey }).select('machine ticketNumber status createdAt').lean();
    if (existingTicket) {
      if (String(existingTicket.machine) !== String(machine._id)) return res.status(409).json({ message: 'This submission key was already used for another machine.' });
      return res.status(200).json({ ticket: { ticketNumber: existingTicket.ticketNumber, status: existingTicket.status, createdAt: existingTicket.createdAt } });
    }
  }
  let ticket;
  try {
    ticket = await Ticket.create({
      machine: machine._id, customer: customer._id, machineType: req.body.machineType || machine.productType,
      issueCategory: req.body.issueCategory, description: req.body.description, errorCode: req.body.errorCode,
      photos: req.body.photos || [], priority: req.body.priority || 'Medium',
      idempotencyKey: idempotencyKey || undefined,
      statusHistory: [{ status: 'Open', note: 'Ticket created', changedBy: 'Customer' }],
      auditTrail: [{ action: 'created', message: 'Ticket created by customer', changedBy: 'Customer' }]
    });
    ticket.ticketNumber = `TKT-${new Date().getFullYear()}-${ticket.id.slice(-6).toUpperCase()}`;
    await ticket.save();
  } catch (error) {
    if (error.code !== 11000 || !idempotencyKey) throw error;
    ticket = await Ticket.findOne({ idempotencyKey });
    if (!ticket || String(ticket.machine) !== String(machine._id)) return res.status(409).json({ message: 'This submission key was already used.' });
    return res.status(200).json({ ticket: { ticketNumber: ticket.ticketNumber, status: ticket.status, createdAt: ticket.createdAt } });
  }
  await Promise.all([
    notifyBackOffice(`New service ticket ${ticket.ticketNumber}`, `${customer.name}: ${ticket.issueCategory} — ${ticket.description}`),
    sendCustomerConfirmation(ticket.ticketNumber, customer.mobile)
  ]);
  res.status(201).json({ ticket: { ticketNumber: ticket.ticketNumber, status: ticket.status, createdAt: ticket.createdAt } });
}));

router.get('/tickets/mine', customerMachine, asyncHandler(async (req, res) => {
  const tickets = await Ticket.find({ machine: req.customerMachine }).select('ticketNumber issueCategory description priority status statusHistory createdAt updatedAt').sort({ createdAt: -1 }).lean();
  res.json({ items: tickets });
}));

router.get('/engineer/tickets', authenticate, allowRoles('engineer'), asyncHandler(async (req, res) => {
  if (!(await Engineer.exists({ _id: req.user.id, active: true }))) return res.status(403).json({ message: 'Your engineer account is not active.' });
  const items = await Ticket.find({ assignedEngineer: req.user.id })
    .populate('machine', 'machineCode productType model serialNumber')
    .populate('customer', 'name mobile')
    .sort({ updatedAt: -1 })
    .lean();
  res.json({ items });
}));

router.patch('/engineer/tickets/:id/status', authenticate, allowRoles('engineer'), [
  param('id').isMongoId(),
  body('status').isIn(['In Progress', 'Resolved']),
  body('note').optional().trim().isLength({ max: 2000 }),
  validate
], asyncHandler(async (req, res) => {
  const engineer = await Engineer.findOne({ _id: req.user.id, active: true }).select('name').lean();
  if (!engineer) return res.status(403).json({ message: 'Your engineer account is not active.' });
  const ticket = await Ticket.findOne({ _id: req.params.id, assignedEngineer: engineer._id })
    .populate('machine', 'machineCode productType model serialNumber')
    .populate('customer', 'name mobile');
  if (!ticket) return res.status(404).json({ message: 'This service request is not assigned to your engineer account.' });
  if (ticket.status === 'Closed' || ticket.status === 'Resolved') {
    return res.status(409).json({ message: 'This service request is already resolved or closed.' });
  }
  const previousStatus = ticket.status;
  const note = req.body.note?.trim() || '';
  ticket.status = req.body.status;
  ticket.statusHistory.push({ status: req.body.status, note, changedBy: engineer.name, at: new Date() });
  ticket.auditTrail.push({
    action: 'status',
    message: `Status changed from ${previousStatus} to ${req.body.status}${note ? `: ${note}` : ''}`,
    changedBy: engineer.name
  });
  await ticket.save();
  await notifyBackOffice(`Ticket ${ticket.ticketNumber} updated by engineer`, `${engineer.name} changed ${ticket.ticketNumber} from ${previousStatus} to ${req.body.status}.${note ? ` Note: ${note}` : ''}`);
  res.json({ ticket });
}));

router.get('/tickets', authenticate, allowRoles('admin', 'service'), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageQuery(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    const expression = searchRegex(req.query.search);
    const related = await relatedSearchIds(expression);
    filter.$or = [{ ticketNumber: expression }, { description: expression }, { machine: { $in: related.machines } }, { customer: { $in: related.customers } }];
  }
  const [items, total] = await Promise.all([
    Ticket.find(filter).populate('machine', 'machineCode productType model serialNumber').populate('customer', 'name mobile').populate('assignedTo', 'name').populate('assignedEngineer', 'name mobile').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Ticket.countDocuments(filter)
  ]);
  res.json({ items, page, limit, total });
}));

router.get('/tickets/:id', authenticate, allowRoles('admin', 'service'), [param('id').isMongoId(), validate], asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id)
    .populate('machine', 'machineCode status productType model serialNumber createdAt')
    .populate('customer', 'name mobile email address')
    .populate('assignedTo', 'name email role')
    .populate('assignedEngineer', 'name mobile')
    .lean();
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  const [installation, customer, machineTickets] = await Promise.all([
    Installation.findOne({ machine: ticket.machine._id }).select('engineerName installationDate siteAddress serialNumber model productType commissioningNotes photos checklist').lean(),
    Customer.findOne({ machine: ticket.machine._id }).select('name mobile email address purchaseDate dealer createdAt').lean(),
    Ticket.find({ machine: ticket.machine._id }).select('ticketNumber issueCategory priority status createdAt').sort({ createdAt: -1 }).limit(20).lean()
  ]);
  res.json({
    ticket,
    machineHistory: {
      machine: ticket.machine,
      installation,
      customer,
      tickets: machineTickets
    }
  });
}));

router.patch('/tickets/:id', authenticate, allowRoles('admin', 'service'), [
  param('id').isMongoId(),
  body('status').optional().isIn(['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed']),
  body('assignedTo').optional({ nullable: true }).isMongoId(),
  body('assignedEngineer').optional({ nullable: true }).isMongoId(),
  body('internalNote').optional().trim().isLength({ max: 2000 }),
  body('resolutionNotes').optional().trim().isLength({ max: 3000 }),
  validate
], asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
  if (req.body.assignedTo && req.body.assignedEngineer) return res.status(422).json({ message: 'Assign this ticket to either a service user or a field engineer, not both.' });
  const auditEntries = [];
  let assignmentNotification;
  if (req.body.status && ticket.status !== req.body.status) {
    const previousStatus = ticket.status;
    ticket.status = req.body.status;
    ticket.statusHistory.push({ status: req.body.status, note: '', changedBy: req.user.name, at: new Date() });
    auditEntries.push({ action: 'status', message: `Status changed from ${previousStatus} to ${req.body.status}`, changedBy: req.user.name });
  }
  if (Object.hasOwn(req.body, 'assignedTo')) {
    const nextAssignee = req.body.assignedTo || null;
    if (nextAssignee) {
      const assignee = await User.findById(nextAssignee).select('name role').lean();
      if (!assignee || assignee.role !== 'service') return res.status(422).json({ message: 'Choose an active service team member to assign this ticket.' });
      const previousAssignee = ticket.assignedTo ? String(ticket.assignedTo) : '';
      const assignmentChanged = previousAssignee !== String(assignee._id);
      ticket.assignedTo = assignee._id;
      if (assignmentChanged) {
        auditEntries.push({ action: 'assignment', message: `Assigned to ${assignee.name}`, changedBy: req.user.name });
      }
      if (ticket.assignedEngineer) {
        auditEntries.push({ action: 'assignment', message: 'Field engineer assignment replaced by service team assignment', changedBy: req.user.name });
        ticket.assignedEngineer = undefined;
      }
      if (ticket.status === 'Open') {
        ticket.status = 'Assigned';
        ticket.statusHistory.push({ status: 'Assigned', note: '', changedBy: req.user.name, at: new Date() });
        auditEntries.push({ action: 'status', message: 'Status changed from Open to Assigned', changedBy: req.user.name });
      }
    } else if (ticket.assignedTo) {
      ticket.assignedTo = undefined;
      auditEntries.push({ action: 'assignment', message: 'Assignment cleared', changedBy: req.user.name });
    }
  }
  if (Object.hasOwn(req.body, 'assignedEngineer')) {
    const nextEngineerId = req.body.assignedEngineer || null;
    if (nextEngineerId) {
      const engineer = await Engineer.findOne({ _id: nextEngineerId, active: true }).select('name mobile').lean();
      if (!engineer) return res.status(422).json({ message: 'Choose an active field engineer to assign this ticket.' });
      const previousEngineer = ticket.assignedEngineer ? String(ticket.assignedEngineer) : '';
      ticket.assignedEngineer = engineer._id;
      if (previousEngineer !== String(engineer._id)) {
        const assignedMachine = await Machine.findById(ticket.machine).select('machineCode').lean();
        if (!assignedMachine) return res.status(404).json({ message: 'The machine for this ticket could not be found.' });
        auditEntries.push({ action: 'assignment', message: `Assigned to field engineer ${engineer.name} (${engineer.mobile})`, changedBy: req.user.name });
        assignmentNotification = { mobile: engineer.mobile, engineerName: engineer.name, ticketNumber: ticket.ticketNumber, machineCode: assignedMachine.machineCode, issueCategory: ticket.issueCategory };
      }
      if (ticket.assignedTo) {
        auditEntries.push({ action: 'assignment', message: 'Service team assignment replaced by field engineer assignment', changedBy: req.user.name });
        ticket.assignedTo = undefined;
      }
      if (ticket.status === 'Open') {
        ticket.status = 'Assigned';
        ticket.statusHistory.push({ status: 'Assigned', note: '', changedBy: req.user.name, at: new Date() });
        auditEntries.push({ action: 'status', message: 'Status changed from Open to Assigned', changedBy: req.user.name });
      }
    } else if (ticket.assignedEngineer) {
      ticket.assignedEngineer = undefined;
      auditEntries.push({ action: 'assignment', message: 'Field engineer assignment cleared', changedBy: req.user.name });
    }
  }
  if (req.body.internalNote?.trim()) {
    auditEntries.push({ action: 'note', message: req.body.internalNote.trim(), changedBy: req.user.name });
  }
  if (req.body.resolutionNotes !== undefined) {
    const notes = req.body.resolutionNotes.trim();
    if (ticket.resolutionNotes !== notes && notes) auditEntries.push({ action: 'resolution', message: 'Resolution notes updated', changedBy: req.user.name });
    ticket.resolutionNotes = notes;
  }
  ticket.auditTrail.push(...auditEntries);
  await ticket.save();
  const [updated, notification] = await Promise.all([
    Ticket.findById(ticket._id).populate('assignedTo', 'name email role').populate('assignedEngineer', 'name mobile').populate('machine', 'machineCode').lean(),
    assignmentNotification ? notifyEngineerAssignment(assignmentNotification) : Promise.resolve(null)
  ]);
  if (assignmentNotification) await notifyBackOffice(`Ticket ${ticket.ticketNumber} assigned to engineer`, `${assignmentNotification.engineerName} (${assignmentNotification.mobile}) has been assigned to ${ticket.ticketNumber}.`);
  res.json({ ticket: updated, ...(notification ? { engineerNotification: notification } : {}) });
}));

router.get('/machines/:id/history', authenticate, allowRoles('admin', 'service'), [
  param('id').isMongoId(), validate
], asyncHandler(async (req, res) => {
  const machine = await Machine.findById(req.params.id).select('machineCode qrUrl status productType model serialNumber createdAt').lean();
  if (!machine) return res.status(404).json({ message: 'Machine not found.' });
  const [installation, customer, tickets] = await Promise.all([
    Installation.findOne({ machine: machine._id }).select('engineerName installationDate siteAddress serialNumber model productType commissioningNotes photos checklist').lean(),
    Customer.findOne({ machine: machine._id }).select('name mobile email address purchaseDate dealer createdAt').lean(),
    Ticket.find({ machine: machine._id }).select('ticketNumber issueCategory priority status createdAt').sort({ createdAt: -1 }).limit(20).lean()
  ]);
  res.json({ machine, installation, customer, tickets });
}));

router.get('/users', authenticate, allowRoles('admin'), asyncHandler(async (_req, res) => {
  const users = await User.find().select('name email role createdAt').sort({ name: 1 }).lean();
  res.json({ items: users });
}));
router.get('/service-users', authenticate, allowRoles('admin', 'service'), asyncHandler(async (_req, res) => {
  const users = await User.find({ role: 'service' }).select('name email role').sort({ name: 1 }).lean();
  res.json({ items: users });
}));
router.get('/assignment-options', authenticate, allowRoles('admin', 'service'), asyncHandler(async (_req, res) => {
  const [serviceUsers, engineers] = await Promise.all([
    User.find({ role: 'service' }).select('name email role').sort({ name: 1 }).lean(),
    Engineer.find({ active: true }).select('name mobile').sort({ name: 1 }).lean()
  ]);
  res.json({ serviceUsers, engineers });
}));
router.post('/users', authenticate, allowRoles('admin'), [body('name').trim().notEmpty(), body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 12 }), body('role').isIn(['admin', 'service']), validate], asyncHandler(async (req, res) => {
  const user = await User.create({ name: req.body.name, email: req.body.email, passwordHash: await User.hashPassword(req.body.password), role: req.body.role });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));
router.get('/engineers', authenticate, allowRoles('admin'), asyncHandler(async (_req, res) => res.json({ items: await Engineer.find().sort({ name: 1 }).lean() })));
router.post('/engineers', authenticate, allowRoles('admin'), [body('name').trim().notEmpty(), body('mobile').matches(/^\+?[0-9\s-]{10,16}$/), validate], asyncHandler(async (req, res) => {
  const engineer = await Engineer.create({ name: req.body.name, mobile: req.body.mobile.replace(/\D/g, '') });
  res.status(201).json({ engineer });
}));

router.get('/dashboard', authenticate, allowRoles('admin', 'service'), asyncHandler(async (_req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const activityStart = new Date(now.getTime() - 42 * 24 * 60 * 60 * 1000);
  const istParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(now);
  const istYear = Number(istParts.find((part) => part.type === 'year').value);
  const istMonth = Number(istParts.find((part) => part.type === 'month').value);
  const installationMonthKeys = Array.from({ length: 6 }, (_, index) =>
    new Date(Date.UTC(istYear, istMonth - 6 + index, 1)).toISOString().slice(0, 7)
  );
  const installationStart = new Date(Date.UTC(istYear, istMonth - 6, 1) - 330 * 60 * 1000);
  const [machines, installed, registered, openTickets, resolvedThisMonth, recentTickets, activity, issueCounts, installationCounts] = await Promise.all([
    Machine.countDocuments(), Machine.countDocuments({ status: 'installed' }), Machine.countDocuments({ status: 'registered' }),
    Ticket.countDocuments({ status: { $in: ['Open', 'Assigned', 'In Progress'] } }),
    Ticket.countDocuments({ status: 'Resolved', updatedAt: { $gte: monthStart } }),
    Ticket.find().populate('machine', 'machineCode').populate('customer', 'name').sort({ createdAt: -1 }).limit(5).lean(),
    Ticket.aggregate([
      { $match: { createdAt: { $gte: activityStart } } },
      { $group: { _id: { $floor: { $divide: [{ $subtract: ['$createdAt', activityStart] }, 7 * 24 * 60 * 60 * 1000] } }, count: { $sum: 1 } } }
    ]),
    Ticket.aggregate([{ $group: { _id: '$issueCategory', count: { $sum: 1 } } }]),
    Installation.aggregate([
      { $match: { installationDate: { $gte: installationStart } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$installationDate', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } }
    ])
  ]);
  const weeklyActivity = Array.from({ length: 6 }, (_, index) => {
    const startDate = new Date(activityStart.getTime() + index * 7 * 24 * 60 * 60 * 1000);
    return { startDate, count: activity.find((week) => week._id === index)?.count || 0 };
  });
  const issueCategories = ['Error code', 'Not starting', 'Noise', 'Performance', 'Other'].map((category) => ({
    category,
    count: issueCounts.find((item) => item._id === category)?.count || 0
  }));
  const installationsByMonth = installationMonthKeys.map((month) => ({
    month,
    count: installationCounts.find((item) => item._id === month)?.count || 0
  }));
  res.json({ stats: { machines, installed, registered, openTickets, resolvedThisMonth }, recentTickets, ticketActivity: weeklyActivity, issueCategories, installationsByMonth });
}));

router.get('/export/:type', authenticate, allowRoles('admin', 'service'), asyncHandler(async (req, res) => {
  const type = req.params.type;
  const search = String(req.query.search || '').trim();
  const expression = search ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
  let exportFilter = {};
  let ExportModel;
  if (type === 'installations') {
    ExportModel = Installation;
    if (expression) {
      const matchingMachines = await Machine.distinct('_id', { machineCode: expression });
      exportFilter = { $or: [{ customerName: expression }, { serialNumber: expression }, { engineerName: expression }, { machine: { $in: matchingMachines } }] };
    }
  } else if (type === 'customers') {
    ExportModel = Customer;
    if (expression) {
      const matchingMachines = await Machine.distinct('_id', { machineCode: expression });
      exportFilter.$or = [{ name: expression }, { mobile: expression }, { serialNumber: expression }, { machine: { $in: matchingMachines } }];
    }
  } else if (type === 'tickets') {
    ExportModel = Ticket;
    if (req.query.status) exportFilter.status = String(req.query.status);
    if (expression) {
      const related = await relatedSearchIds(expression);
      exportFilter.$or = [{ ticketNumber: expression }, { description: expression }, { machine: { $in: related.machines } }, { customer: { $in: related.customers } }];
    }
  } else if (type === 'machine-master') {
    ExportModel = Machine;
    if (req.query.status) exportFilter.status = String(req.query.status);
    if (expression) exportFilter.$or = [{ machineCode: expression }, { productType: expression }, { model: expression }, { serialNumber: expression }];
  } else return res.status(404).json({ message: 'This export is not available.' });
  if (await ExportModel.countDocuments(exportFilter) > 5000) {
    return res.status(413).json({ message: 'This export exceeds the 5,000-row synchronous limit. Narrow the filters and try again.' });
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = config.companyName;
  const sheet = workbook.addWorksheet(type === 'machine-master' ? 'Machine Master' : `${type.charAt(0).toUpperCase()}${type.slice(1)}`);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  let rows;
  if (type === 'installations') {
    sheet.columns = [{ header: 'Installed', key: 'date', width: 22 }, { header: 'Machine code', key: 'machine', width: 18 }, { header: 'Serial number', key: 'serial', width: 22 }, { header: 'Customer', key: 'customer', width: 24 }, { header: 'Mobile', key: 'mobile', width: 18 }, { header: 'Engineer', key: 'engineer', width: 22 }, { header: 'Site address', key: 'address', width: 38 }];
    rows = await Installation.find(exportFilter).populate('machine', 'machineCode').sort({ createdAt: -1 }).lean();
    rows.forEach((row) => sheet.addRow({ date: formatIST(row.installationDate), machine: row.machine?.machineCode, serial: row.serialNumber, customer: row.customerName, mobile: row.customerMobile, engineer: row.engineerName, address: row.siteAddress }));
  } else if (type === 'customers') {
    sheet.columns = [{ header: 'Name', key: 'name', width: 24 }, { header: 'Mobile', key: 'mobile', width: 18 }, { header: 'Email', key: 'email', width: 28 }, { header: 'Machine code', key: 'machine', width: 18 }, { header: 'Serial number', key: 'serial', width: 22 }, { header: 'Registered', key: 'date', width: 22 }];
    rows = await Customer.find(exportFilter).populate('machine', 'machineCode').sort({ createdAt: -1 }).lean();
    rows.forEach((row) => sheet.addRow({ name: row.name, mobile: row.mobile, email: row.email, machine: row.machine?.machineCode, serial: row.serialNumber, date: formatIST(row.createdAt) }));
  } else if (type === 'tickets') {
    sheet.columns = [{ header: 'Ticket', key: 'ticket', width: 22 }, { header: 'Machine code', key: 'machine', width: 18 }, { header: 'Customer', key: 'customer', width: 24 }, { header: 'Category', key: 'category', width: 20 }, { header: 'Priority', key: 'priority', width: 14 }, { header: 'Status', key: 'status', width: 18 }, { header: 'Created', key: 'date', width: 22 }, { header: 'Description', key: 'description', width: 50 }];
    rows = await Ticket.find(exportFilter).populate('machine', 'machineCode').populate('customer', 'name').sort({ createdAt: -1 }).lean();
    rows.forEach((row) => sheet.addRow({ ticket: row.ticketNumber, machine: row.machine?.machineCode, customer: row.customer?.name, category: row.issueCategory, priority: row.priority, status: row.status, date: formatIST(row.createdAt), description: row.description }));
  } else if (type === 'machine-master') {
    sheet.columns = [{ header: 'Machine code', key: 'machine', width: 18 }, { header: 'Status', key: 'status', width: 16 }, { header: 'Product', key: 'product', width: 22 }, { header: 'Model', key: 'model', width: 20 }, { header: 'Serial number', key: 'serial', width: 22 }, { header: 'Customer', key: 'customer', width: 24 }, { header: 'Ticket count', key: 'tickets', width: 16 }];
    rows = await Machine.find(exportFilter).sort({ createdAt: -1 }).lean();
    const machineIds = rows.map((machine) => machine._id);
    const [customers, ticketCounts] = await Promise.all([
      Customer.find({ machine: { $in: machineIds } }).select('machine name').lean(),
      Ticket.aggregate([
        { $match: { machine: { $in: machineIds } } },
        { $group: { _id: '$machine', count: { $sum: 1 } } }
      ])
    ]);
    const customerNames = new Map(customers.map((customer) => [String(customer.machine), customer.name]));
    const ticketCountsByMachine = new Map(ticketCounts.map((item) => [String(item._id), item.count]));
    rows.forEach((machine) => sheet.addRow({
      machine: machine.machineCode,
      status: machine.status,
      product: machine.productType,
      model: machine.model,
      serial: machine.serialNumber,
      customer: customerNames.get(String(machine._id)) || '',
      tickets: ticketCountsByMachine.get(String(machine._id)) || 0
    }));
  }
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF145C4A' } };
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}));

router.get('/qr/:machineCode.png', asyncHandler(async (req, res) => {
  const machine = await Machine.findOne({ machineCode: req.params.machineCode.toUpperCase() }).select('qrUrl');
  if (!machine) return res.status(404).json({ message: 'Machine not found.' });
  res.type('png');
  return QRCode.toFileStream(res, machine.qrUrl, { width: 512, margin: 2, errorCorrectionLevel: 'H' });
}));

async function getMachineQrSelection(req, res) {
  const machineIds = typeof req.query.ids === 'string' ? req.query.ids.split(',').filter(Boolean) : [];
  if (!machineIds.length || machineIds.length > 500 || machineIds.some((id) => !/^[a-f\d]{24}$/i.test(id))) {
    res.status(422).json({ message: 'Select between 1 and 500 valid machine records for download.' });
    return null;
  }
  const machines = await Machine.find({ _id: { $in: machineIds } }).select('machineCode qrUrl productType model').lean();
  if (machines.length !== machineIds.length) {
    res.status(404).json({ message: 'One or more selected machines were not found.' });
    return null;
  }
  const byId = new Map(machines.map((machine) => [String(machine._id), machine]));
  return machineIds.map((id) => byId.get(id));
}

router.get('/machines/qr.zip', authenticate, allowRoles('admin'), asyncHandler(async (req, res, next) => {
  const machines = await getMachineQrSelection(req, res);
  if (!machines) return;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="machine-qr-codes.zip"');
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', next);
  archive.pipe(res);
  for (const machine of machines) {
    const png = await QRCode.toBuffer(machine.qrUrl, { width: 512, margin: 2, errorCorrectionLevel: 'H' });
    archive.append(png, { name: `${machine.machineCode}.png` });
  }
  await archive.finalize();
}));

router.get('/machines/qr.pdf', authenticate, allowRoles('admin'), asyncHandler(async (req, res) => {
  const machines = await getMachineQrSelection(req, res);
  if (!machines) return;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="machine-qr-sticker-sheet.pdf"');
  const doc = new PDFDocument({ size: 'A4', margin: 30, autoFirstPage: true });
  doc.on('error', (error) => {
    if (!res.headersSent) res.status(500).json({ message: 'Could not generate the QR sticker sheet.' });
    else res.destroy(error);
  });
  doc.pipe(res);
  const pageWidth = doc.page.width;
  const margin = 30;
  const columns = 4;
  const rows = 5;
  const gapX = 8;
  const gapY = 8;
  const headerHeight = 48;
  const cardWidth = (pageWidth - margin * 2 - gapX * (columns - 1)) / columns;
  const cardHeight = (doc.page.height - margin * 2 - headerHeight - gapY * (rows - 1)) / rows;
  const qrSize = Math.min(cardWidth - 18, cardHeight - 48);
  function drawHeader(pageNumber) {
    doc.fillColor('#145c4a').font('Helvetica-Bold').fontSize(16).text(config.companyName, margin, margin);
    doc.fillColor('#5c6b63').font('Helvetica').fontSize(8).text('Scan for installation and service support', margin, margin + 21);
    doc.fillColor('#87938d').fontSize(8).text(`QR STICKER SHEET  ·  ${pageNumber}`, pageWidth - 150, margin + 4, { width: 120, align: 'right' });
    doc.moveTo(margin, margin + headerHeight - 5).lineTo(pageWidth - margin, margin + headerHeight - 5).strokeColor('#dce6df').stroke();
  }
  drawHeader(1);
  for (const [index, machine] of machines.entries()) {
    const indexOnPage = index % (columns * rows);
    if (index > 0 && indexOnPage === 0) {
      doc.addPage();
      drawHeader(Math.floor(index / (columns * rows)) + 1);
    }
    const row = Math.floor(indexOnPage / columns);
    const column = indexOnPage % columns;
    const x = margin + column * (cardWidth + gapX);
    const y = margin + headerHeight + row * (cardHeight + gapY);
    const png = await QRCode.toBuffer(machine.qrUrl, { width: 256, margin: 1, errorCorrectionLevel: 'H' });
    doc.roundedRect(x, y, cardWidth, cardHeight, 5).lineWidth(0.7).strokeColor('#cbd8cf').stroke();
    doc.image(png, x + (cardWidth - qrSize) / 2, y + 8, { width: qrSize, height: qrSize });
    doc.fillColor('#1d302a').font('Helvetica-Bold').fontSize(9).text(machine.machineCode, x + 4, y + qrSize + 13, { width: cardWidth - 8, align: 'center' });
    doc.fillColor('#718077').font('Helvetica').fontSize(6.5).text('SCAN FOR INSTALLATION & SERVICE', x + 4, y + qrSize + 28, { width: cardWidth - 8, align: 'center' });
  }
  doc.end();
}));

router.get('/meta', (_req, res) => res.json({
  company: config.companyName,
  customerRegistrationOtp: false,
  issueCategories: ['Error code', 'Not starting', 'Noise', 'Performance', 'Other'],
  installationChecklist: checklistDefaults
}));

export default router;
