# IIT Ropar Medical Center

A full-stack web application for the IIT Ropar Medical Center — appointment booking, patient records management, prescription tracking, and more.

## Tech Stack

- **Backend:** Node.js, Express.js
- **Templating:** EJS
- **Database:** PostgreSQL
- **Auth:** bcryptjs + express-session

## Features

- **Public Pages:** Home, Team, Schedule, Facilities, Information, Health Bulletins, Feedback
- **Appointment Booking:** 3-step wizard — choose doctor → pick date/slot → confirm with symptoms
- **Admin Dashboard:** Stats, patient management, appointment management, prescription creation, bulletin & feedback management
- **Patient Portal:** View appointments, prescriptions, medical records, profile management
- **Role-Based Access:** Student, Doctor, Admin roles with middleware guards

## Prerequisites

- **Node.js** v16+ installed
- **PostgreSQL** installed and running (default port 5432)

## Setup Instructions

### 1. Install Dependencies

```bash
cd medical-center
npm install
```

### 2. Create the PostgreSQL Database

Open a terminal / pgAdmin and create the database:

```sql
CREATE DATABASE medical_center;
```

### 3. Configure Environment

The `.env` file is pre-configured for a local PostgreSQL instance:

```
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/medical_center
SESSION_SECRET=iitrpr-medical-center-secret-key-2024
```

Update `DATABASE_URL` if your PostgreSQL username/password differ.

### 4. Initialize Database (Create Tables)

```bash
npm run db:init
```

### 5. Seed Sample Data

```bash
npm run db:seed
```

### 6. Start the Server

Development (with auto-reload):
```bash
npm run dev
```

Production:
```bash
npm start
```

The server runs at **http://localhost:3000**

## Test Accounts

| Role    | Email                 | Password    |
|---------|-----------------------|-------------|
| Admin   | admin@iitrpr.ac.in    | admin123    |
| Doctor  | dr.sharma@iitrpr.ac.in| doctor123   |
| Doctor  | dr.gupta@iitrpr.ac.in | doctor123   |
| Doctor  | dr.kumar@iitrpr.ac.in | doctor123   |
| Student | rithwik@iitrpr.ac.in  | student123  |

## Project Structure

```
medical-center/
├── app.js                  # Express app entry point
├── config/
│   └── db.js               # PostgreSQL connection pool
├── db/
│   ├── schema.sql          # Database tables
│   ├── init.js             # Schema runner
│   └── seed.js             # Sample data seeder
├── middleware/
│   └── auth.js             # Auth & role guards
├── models/
│   └── queries.js          # All database queries
├── routes/
│   ├── index.js            # Public pages
│   ├── auth.js             # Login, Register, Logout
│   ├── appointments.js     # Booking, slots API
│   ├── admin.js            # Admin dashboard & CRUD
│   ├── patient.js          # Patient portal
│   └── feedback.js         # Feedback form
├── views/
│   ├── partials/           # header, navbar, footer
│   ├── auth/               # login, register
│   ├── appointments/       # booking wizard
│   ├── admin/              # admin dashboard views
│   └── patient/            # patient portal views
├── public/
│   ├── css/style.css       # Stylesheet
│   └── js/main.js          # Frontend JavaScript
├── .env
├── .gitignore
└── package.json
```

## Doctors

| Doctor            | Specialization                  | Available Days |
|-------------------|---------------------------------|----------------|
| Dr. Rajesh Sharma | General Medicine                | Mon–Fri        |
| Dr. Priya Gupta   | Mental Health & Counseling      | Mon–Sat        |
| Dr. Anil Kumar    | Orthopedics & Sports Medicine   | Tue, Thu, Sat  |

---

## Deploying to Vercel

1. Push your code to a GitHub/GitLab/Bitbucket repo.
2. Import the repo in [Vercel](https://vercel.com/import).
3. In Vercel dashboard, set these Environment Variables:
   - `DATABASE_URL` (your production Postgres URL)
   - `SESSION_SECRET` (any random string)
4. Vercel will auto-detect the project and deploy.

**Note:**
- The same codebase works for both localhost and Vercel. Only the environment variables differ.
- For local development, copy `.env.example` to `.env` and fill in your values.
- For Vercel, set the variables in the dashboard (Project Settings → Environment Variables).

---
