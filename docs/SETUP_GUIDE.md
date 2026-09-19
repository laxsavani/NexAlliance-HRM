# NexAlliance HRM - Setup & Development Guide

## 1. Prerequisites
- **Node.js**: v18+ or v20+ LTS
- **MongoDB Atlas** or local MongoDB instance
- **npm** package manager

---

## 2. Environment Configuration
Create or verify `.env` file in project root:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.cwpvxt8.mongodb.net/NexAlliance
JWT_SECRET=nexalliance_super_secure_jwt_secret_key_2026_hrm_prod
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

---

## 3. Installation & Database Seeding

### 3.1 Install Dependencies
```bash
npm install
```

### 3.2 Run Idempotent Seeder
Seeds System Roles, 34 Permission Actions, Default Permission Matrix, Default Branch & Department, and the initial Super Admin user:
```bash
npm run seed
```

Default Super Admin Credentials:
- **Email:** `admin@nexalliance.com`
- **Password:** `Admin@12345`

---

## 4. Starting the Server

### Development Mode (with hot-reload):
```bash
npm run dev
```

### Production Mode:
```bash
npm start
```

---

## 5. Interactive Swagger Documentation
Open your browser and navigate to:
🌐 **`http://localhost:5000/api/docs`**

To test protected routes:
1. Call `POST /api/auth/login` with `admin@nexalliance.com` / `Admin@12345`.
2. Copy the `token` string from the response.
3. Click the green **Authorize** button at the top right of the Swagger UI.
4. Paste the token into the value box and click **Authorize**.
5. All protected endpoints are now executable directly from the browser!

---

## 6. Running Automated Tests
To run the end-to-end integration and security test suite:
```bash
node scripts/test_api.js
```
Expected output:
```
=============================================================
🎉 ALL INTEGRATION AND SECURITY TESTS PASSED PERFECTLY!
=============================================================
```
