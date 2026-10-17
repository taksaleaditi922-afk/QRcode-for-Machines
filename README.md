# Ve R Mobility Solutions — Machine Care Platform

A mobile-first MERN application for machine installation, customer registration, service tickets, and back-office operations for an automation/equipment business.

## Features

- Machine QR codes open a mobile-first portal chooser for Engineer or Customer
- Engineers verify by OTP before recording installation and customer details
- Customers register machines and request service without OTP verification
- Installable customer PWA with Android and iPhone home-screen icons
- Engineer mobile verification with OTP-based access
- QR-scoped customer access to a registered machine's service history and ticket form on each scan
- Resized installation and ticket photo uploads with server-side type and size limits
- Admin dashboard with summary cards, search, filters, status updates, and role-based access
- Data-backed ticket activity dashboard and filtered Excel exports for installations, customers, tickets, and machine master data
- Email/notification hooks with mock providers in development
- Seed data for admin, engineers, and sample machines
- PWA-friendly frontend with branded, responsive styling

## Using machine QR codes on a phone

Machine QR codes open a mobile portal chooser at `/m/:machineCode`. Customers choose **Customer** to register an installed machine without OTP or, later, report an issue and review service requests. Engineers choose **Engineer** and must verify by OTP before recording installation and customer details. New service requests appear in the admin ticket dashboard and can be assigned to active field engineers or service team members. When assigned, field engineers receive an SMS and can verify again at `/engineer` to view their work and update request status. Configure Twilio credentials or an MSG91 assignment flow (`MSG91_ASSIGNMENT_TEMPLATE_ID`) to deliver assignment SMS; in development or when SMS is not configured, notification details are logged and the admin dashboard reports that delivery was unavailable. Email alerts require `BACK_OFFICE_EMAILS` and working SMTP settings; tickets remain visible in the dashboard regardless. The customer app home is `/app`. On Android, use the browser's **Install app** option; on iPhone, use **Share → Add to Home Screen**.

For local phone testing, set `PUBLIC_APP_URL` to the computer's Wi-Fi address (for example, `http://192.168.1.25:5173`) and add that origin to `CLIENT_URL`. Connect the phone to the same Wi-Fi network, restart the app, and generate or re-download QR codes. The phone-accessible local URL works for browser testing, but installing a PWA on a phone requires HTTPS. For customer use outside the local network and PWA installation, deploy the app on HTTPS and set both values to its public URL.

## Stack

- Frontend: React + Vite + custom responsive CSS + React Router
- Backend: Node.js + Express.js + Mongoose + JWT
- Database: MongoDB
- Excel: ExcelJS
- QR generation: qrcode
- Notifications: nodemailer + provider abstraction
- Validation: express-validator + Zod on the client
- Uploads: Multer disk storage in development (images resized in the browser, 5 MB server-side limit)

## Project Structure

```text
QRcode/
├─ client/
│  ├─ public/
│  ├─ src/
│  ├─ index.html
│  ├─ package.json
│  └─ vite.config.js
├─ server/
│  ├─ src/
│  ├─ package.json
│  └─ uploads/
├─ .env.example
├─ .gitignore
├─ package.json
├─ package-lock.json
├─ README.md
└─ node_modules/
```

## Prerequisites

- Node.js 18+
- MongoDB running locally or MongoDB Atlas connection
- npm

## Environment Setup

1. Copy the sample environment file into the repository root as `.env`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS/Linux:

```bash
cp .env.example .env
```

2. Update the values in `.env` for your environment. The backend loads this root-level file even when started through its workspace script.

Example values:

```env
NODE_ENV=development
COMPANY_NAME=Ve R Mobility Solutions
PORT=4001
MONGODB_URI=mongodb://127.0.0.1:27017/qr-machine-care
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_URL=http://localhost:5173
PUBLIC_APP_URL=http://localhost:5173
BACK_OFFICE_EMAILS=ops@company.com,service@company.com
ADMIN_NAME=System Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeThisPassword123!
VITE_COMPANY_NAME=Ve R Mobility Solutions
VITE_SUPPORT_EMAIL=support@your-domain.com
VITE_SUPPORT_PHONE=7710 900 333
```

The support phone defaults to Ve R Mobility Solutions at `7710 900 333`; set `VITE_SUPPORT_PHONE` to override it. Add a real support email before sharing QR codes if email support is required.

3. Install dependencies from the repo root:

```bash
npm install
```

## Run the App

### Start both frontend and backend together

```bash
npm run dev
```

### Or run each separately

Backend:

```bash
npm run dev -w server
```

Frontend:

```bash
npm run dev -w client
```

## Seed Data

When no `MONGODB_URI` is configured and a local MongoDB server is unavailable, development startup uses an in-memory MongoDB and creates a sample admin, engineer, and machines automatically. This data is cleared when the app stops.

For persistent data, configure a local MongoDB service or MongoDB Atlas in `MONGODB_URI`, then run the seed script:

```bash
npm run seed
```

Default development admin credentials:

- Email: `admin@example.com`
- Password: `ChangeThisPassword123!`

Change these values in `.env` before exposing the app to a network. The seed script requires a persistent MongoDB connection; it intentionally does not seed a temporary in-memory database that disappears on exit.

## Production Notes

- Set `JWT_SECRET`, `MONGODB_URI`, and production email credentials before deployment.
- Configure `MONGODB_URI` to use persistent storage; in-memory mode is development-only.
- Configure a durable upload volume or replace local disk storage with Cloudinary/S3 before deploying multiple backend instances.
- Replace mock OTP and notification logic with actual provider services when ready.
- Use a production MongoDB cluster and configure CORS and security headers appropriately.
- Synchronous Excel exports are capped at 5,000 rows; narrow filters for larger datasets.

## Admin Access

- Login page: `http://localhost:5173/login`
- Protected admin routes: `http://localhost:5173/admin`

## Future Improvements

- WhatsApp bot integration
- Warranty tracking
- AMC reminders
- Spare-parts management
- Multi-language support (English, Hindi, Marathi)

## Deployment

- Backend: Render / Railway / AWS
- Frontend: Vercel / Netlify
- Database: MongoDB Atlas

## Important

This project is a functional development implementation. Configure persistent MongoDB, secure production secrets, durable image storage, and real OTP/email providers before deploying it for live customer data.
