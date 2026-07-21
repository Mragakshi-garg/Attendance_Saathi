<div align="center">
  <h1>📸 Attendance Saathi</h1>
  <p><strong>A Production-Level Face Recognition Attendance System</strong></p>
</div>

<br />

FaceAttend is a modern, production-ready attendance system that uses facial recognition for seamless and secure user authentication. It features a robust Node.js/Express backend coupled with a Python-based face recognition service, all wrapped in a sleek user interface.

## ✨ Key Features

- 👤 **Facial Recognition Attendance**: Secure and fast check-ins using advanced face matching algorithms.
- ✉️ **Email OTP Verification**: Secure registration workflow using NodeMailer for email-based one-time passwords.
- 🔒 **JWT Authentication**: Token-based authentication for secure API access.
- ☁️ **Cloud Storage**: Seamless integration with Cloudinary for handling and storing user face encodings and images.
- 🎨 **Modern UI**: Polished interface with dark mode, glassmorphism elements, and dynamic interactions.
- 🗄️ **Database**: MongoDB integration via Mongoose for reliable and scalable data persistence.

## 🛠️ Technology Stack

- **Backend core**: Node.js, Express.js
- **Face Recognition Service**: Python, OpenCV (assumed based on structure)
- **Database**: MongoDB (Mongoose)
- **Security & Auth**: JSON Web Tokens (JWT), bcryptjs
- **Media & Files**: Multer, Cloudinary
- **Mail Service**: Nodemailer

## 📁 Project Structure

```text
face/
├── public/                 # Frontend static files (HTML, CSS, JS)
├── python/                 # Python Face Recognition Microservice
│   ├── face_server.py      # Main Python server for facial matching
│   ├── requirements.txt    # Python dependencies
│   ├── Procfile            # Deployment configuration for Python
│   └── runtime.txt         # Python runtime version
├── server/                 # Node.js Express Backend
│   ├── config/             # Database and environment configurations
│   ├── controllers/        # Request handlers for routes
│   ├── middleware/         # Custom middlewares (auth, file upload)
│   ├── models/             # Mongoose database schemas
│   ├── routes/             # API route definitions
│   ├── services/           # Business logic (e.g., mailService)
│   ├── utils/              # Helper functions
│   ├── index.js            # Main backend entry point
│   └── setup.js            # Initial setup script
├── .env.example            # Example environment variables
├── package.json            # Node.js dependencies and scripts
└── vercel.json / Procfile  # Deployment configurations
```

## 🚀 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd face
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Install Python dependencies**:
   ```bash
   cd python
   pip install -r requirements.txt
   cd ..
   ```

4. **Environment Variables**:
   Copy the `.env.example` file to `.env` and configure the necessary variables:
   - MongoDB URI
   - Cloudinary credentials
   - JWT secret
   - Email SMTP credentials (`MAIL_USERNAME`, `MAIL_PASSWORD`)

5. **Run the application (Development)**:
   ```bash
   npm run dev
   ```

## ☁️ Deployment Notes

This system is configured for seamless deployment on platforms like **Render**, **Vercel**, or **Heroku**. 

> [!IMPORTANT]
> **OTP Emails in Production**
> If you deploy this application and find that OTP emails are not being sent (but work locally):
> 1. **Environment Variables**: Ensure `MAIL_USERNAME` and `MAIL_PASSWORD` are explicitly set in your hosting provider's environment settings.
> 2. **Gmail App Passwords**: If using Gmail, you cannot use your standard Google password in production. You must generate an [App Password](https://support.google.com/accounts/answer/185833?hl=en) and use that 16-character string as the `MAIL_PASSWORD`.
> 3. **Fallback Logging**: The system falls back to logging the OTP to the console if email sending fails or credentials are missing. Check your server logs on Render/Vercel during registration to find the OTP if the email doesn't arrive.

## 📝 License

This project is licensed under the MIT License.
