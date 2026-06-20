Markdown
# 🚀 Full-Stack AI Chatbot Architecture

A production-grade AI assistant featuring real-time LLM streaming, cloud-synchronized chat history, and Firebase-secured authentication.

## 📂 Project Structure
- **/client**: React frontend (Vite).
- **/server**: Node.js backend (Express).

## 🛠️ Getting Started

### 1. Installation
From the root directory, install dependencies for both the client and server:
```bash
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..
2. Environment Setup
Create the required .env files. Do not commit these to Git.

Server (server/.env):
GEMINI_API_KEY=your_gemini_api_key

Client (client/.env):
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

3. Running the Project
Use the concurrently script from the root folder:

Bash
npm start
🏗️ System Overview
Authentication: Managed via Firebase Auth in /client.

Database: Chat threads are persisted in Firestore, scoped by user uid.

API: The React client makes POST requests to the Express server in /server.