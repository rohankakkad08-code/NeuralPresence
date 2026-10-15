# 🧠 FaceTrack AI — Cloud-Based Face Recognition Attendance System

A modern, full-stack attendance management system powered by real-time facial recognition.
Built with Python (Flask), OpenCV, `face_recognition`, and an animated HTML/CSS/JS frontend.

---

## 🚀 Features

| Feature | Description |
|---|---|
| **Real-Time Face Recognition** | OpenCV + face_recognition library for sub-second identification |
| **Webcam Enrollment** | Register students with a live webcam snapshot |
| **Auto-Scan Mode** | Continuously scan and mark attendance every 3 seconds |
| **Smart Dashboard** | Live stats, weekly charts, present/absent breakdown |
| **Attendance Reports** | Filter by date range & department, export to CSV |
| **Student Management** | Add, view, and remove registered students |
| **Confidence Scoring** | Each recognition includes a confidence percentage |
| **Animated Landing Page** | Particle canvas, scan animations, counter effects |
| **Responsive Design** | Works on desktop, tablet, and mobile |

---

## 🐳 Docker Deployment (Recommended — Local or Any Server)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed

### Step 1 — Clone the repo

```bash
git clone https://github.com/<your-username>/face-attendance.git
cd face-attendance/face_attendance
```

### Step 2 — Start with Docker Compose

```bash
docker compose up --build
```

This spins up two containers:
- **`db`** — PostgreSQL 16 (data persisted in a named volume)
- **`app`** — Flask + Gunicorn (served on port 5000)

Open **http://localhost:5000** in your browser.

### Step 3 — Stop / Restart

```bash
# Stop containers (data is preserved)
docker compose down

# Restart
docker compose up
```

### Step 4 — Rebuild after code changes

```bash
docker compose up --build
```

> **Note:** Uploaded face photos are stored in a Docker volume (`face_images`) so they survive restarts.

---

## ☁️ Deploy on Render (Free Tier — Docker)

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<your-username>/face-attendance.git
git push -u origin main
```

> The **root of the repo** must be the `face_attendance/` folder, or push the whole project and set `rootDir: face_attendance` in `render.yaml`.

### Step 2 — Create a Blueprint on Render

1. Go to [render.com](https://render.com) and sign in with GitHub
2. Click **New → Blueprint**
3. Select your GitHub repo
4. Render detects `render.yaml` and automatically creates:
   - A **PostgreSQL** database (free)
   - A **Docker web service** (free)

### Step 3 — Environment Variables (auto-configured)

`render.yaml` already sets these:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Render PostgreSQL connection string (auto-injected) |
| `SECRET_KEY` | Auto-generated secure key |

### Step 4 — Build Time

The first build compiles `dlib` from source inside Docker — this takes **8–15 minutes**. Subsequent deploys use Docker layer cache and are much faster.

---

## 🔐 Default Login

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `admin123` |

---

## ⚙️ Local Setup (without Docker)

```bash
cd face_attendance
pip install -r requirements.txt
python app.py
```

App starts at **http://localhost:5000** (uses SQLite locally).

> Requires CMake and a C++ compiler for `dlib`. On Windows, install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).

---

## 📁 Project Structure

```
face_attendance/
├── app.py                    # Flask backend (routes, API, face recognition)
├── requirements.txt          # Python dependencies
├── Dockerfile                # Docker image (multi-stage, dlib pre-compiled)
├── docker-compose.yml        # App + PostgreSQL local stack
├── .dockerignore             # Files excluded from Docker build context
├── render.yaml               # Render Blueprint config (Docker runtime)
├── Procfile                  # Fallback Gunicorn start command
├── static/
│   ├── css/style.css
│   ├── js/
│   └── faces/                # Student photos (auto-created at runtime)
└── templates/
    ├── index.html
    ├── login.html
    ├── dashboard.html
    ├── attendance.html
    └── reports.html
```

---

## 🛠️ API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/register` | Register a new student with face |
| `GET` | `/api/students` | List all registered students |
| `DELETE` | `/api/students/<id>` | Remove a student |
| `POST` | `/api/recognize` | Recognize a face from image |
| `GET` | `/api/attendance?date=` | Get attendance for a date |
| `GET` | `/api/attendance/all` | Get all attendance records |
| `GET` | `/api/stats` | Get dashboard statistics |

---

## 🧰 Tech Stack

- **Backend:** Python, Flask, Flask-CORS, Gunicorn
- **Face AI:** face_recognition, dlib, OpenCV
- **Database:** PostgreSQL (Docker / Render) / SQLite (local without Docker)
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Charts:** Chart.js
- **Icons:** Font Awesome 6
- **Container:** Docker (multi-stage build)

---

## 📄 License

MIT License — Free to use and modify for personal and educational projects.
