from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import cv2
import face_recognition
import numpy as np
import os
import json
import base64
import datetime
import threading

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "neuralpresence_secret_2024")
CORS(app, supports_credentials=True)

# ─── Absolute paths ───────────────────────────────────────────────────────────
BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "faces")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ─── Database Configuration (PostgreSQL on Render, SQLite locally) ────────────
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'attendance.db')}")

# Render gives "postgres://..." but SQLAlchemy needs "postgresql://..."
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# ─── Models ───────────────────────────────────────────────────────────────────
class Student(db.Model):
    __tablename__ = "students"

    id            = db.Column(db.Integer,  primary_key=True, autoincrement=True)
    name          = db.Column(db.String(255), nullable=False)
    student_id    = db.Column(db.String(100), unique=True, nullable=False)
    department    = db.Column(db.String(255))
    email         = db.Column(db.String(255))
    face_encoding = db.Column(db.Text)
    image_path    = db.Column(db.String(500))
    registered_at = db.Column(db.DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))


class Attendance(db.Model):
    __tablename__ = "attendance"

    id           = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id   = db.Column(db.String(100), nullable=False)
    student_name = db.Column(db.String(255), nullable=False)
    department   = db.Column(db.String(255))
    date         = db.Column(db.String(20), nullable=False)
    time         = db.Column(db.String(20), nullable=False)
    status       = db.Column(db.String(50), default="Present")
    confidence   = db.Column(db.Float)

    __table_args__ = (
        db.UniqueConstraint("student_id", "date", name="uq_student_date"),
    )


class User(db.Model):
    __tablename__ = "users"

    id       = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role     = db.Column(db.String(50), default="admin")


def init_db():
    """Create all tables and seed a default admin account."""
    db.create_all()
    if not User.query.filter_by(username="admin").first():
        db.session.add(User(username="admin", password="admin123", role="admin"))
        db.session.commit()


# ─── In-memory face cache (thread-safe) ──────────────────────────────────────
known_encodings: list = []
known_names:     list = []
known_ids:       list = []
_cache_lock = threading.Lock()


def load_known_faces():
    """Reload all face encodings from DB into memory."""
    global known_encodings, known_names, known_ids

    rows = Student.query.with_entities(
        Student.name, Student.student_id, Student.face_encoding
    ).filter(Student.face_encoding.isnot(None)).all()

    enc_list, name_list, id_list = [], [], []
    for row in rows:
        try:
            enc = np.array(json.loads(row.face_encoding), dtype=np.float64)
            enc_list.append(enc)
            name_list.append(row.name)
            id_list.append(row.student_id)
        except Exception:
            pass  # skip corrupted rows

    with _cache_lock:
        known_encodings = enc_list
        known_names     = name_list
        known_ids       = id_list


# ─── Startup: runs for both gunicorn (--preload) and direct `python app.py` ───
with app.app_context():
    init_db()
    load_known_faces()

# ─── Helper: decode base64 image → numpy BGR array ───────────────────────────
def decode_image(b64_string: str):
    """Accepts both 'data:image/jpeg;base64,XXX' and raw base64."""
    if "," in b64_string:
        b64_string = b64_string.split(",", 1)[1]
    img_bytes = base64.b64decode(b64_string)
    np_arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("cv2.imdecode returned None — invalid image bytes")
    return img


# ═════════════════════════════════════════════════════════════════════════════
#  PAGE ROUTES
# ═════════════════════════════════════════════════════════════════════════════

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        data     = request.get_json(silent=True) or {}
        username = (data.get("username") or "").strip()
        password = data.get("password") or ""

        if not username or not password:
            return jsonify({"success": False, "message": "Username and password are required"}), 400

        user = User.query.filter_by(username=username, password=password).first()
        if user:
            session["user"] = username
            session["role"] = user.role
            return jsonify({"success": True, "message": "Login successful"})
        return jsonify({"success": False, "message": "Invalid username or password"}), 401

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")


@app.route("/attendance_page")
def attendance_page():
    return render_template("attendance.html")


@app.route("/reports_page")
def reports_page():
    return render_template("reports.html")


# ═════════════════════════════════════════════════════════════════════════════
#  STUDENT API
# ═════════════════════════════════════════════════════════════════════════════

@app.route("/api/register", methods=["POST"])
def register_student():
    data       = request.get_json(silent=True) or {}
    name       = (data.get("name") or "").strip()
    student_id = (data.get("student_id") or "").strip()
    department = (data.get("department") or "").strip()
    email      = (data.get("email") or "").strip()
    image_data = data.get("image")

    if not name or not student_id:
        return jsonify({"success": False, "message": "Name and Student ID are required"}), 400
    if not image_data:
        return jsonify({"success": False, "message": "No image provided"}), 400

    # Decode image
    try:
        img = decode_image(image_data)
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    except Exception as e:
        return jsonify({"success": False, "message": f"Invalid image data: {e}"}), 400

    # Detect face
    face_locs = face_recognition.face_locations(rgb, model="hog")
    if not face_locs:
        return jsonify({"success": False, "message": "No face detected — please retake the photo"}), 400

    encoding = face_recognition.face_encodings(rgb, face_locs)[0]

    # Persist image to disk
    img_abs = os.path.join(UPLOAD_FOLDER, f"{student_id}.jpg")
    img_url = f"static/faces/{student_id}.jpg"
    cv2.imwrite(img_abs, img)

    # Insert into DB
    if Student.query.filter_by(student_id=student_id).first():
        return jsonify({"success": False, "message": f"Student ID '{student_id}' is already registered"}), 409

    student = Student(
        name=name,
        student_id=student_id,
        department=department,
        email=email,
        face_encoding=json.dumps(encoding.tolist()),
        image_path=img_url,
    )
    db.session.add(student)
    db.session.commit()

    load_known_faces()
    return jsonify({"success": True, "message": f"{name} registered successfully!"})


@app.route("/api/students", methods=["GET"])
def get_students():
    rows = Student.query.order_by(Student.name).all()
    return jsonify([
        {
            "id": s.id,
            "name": s.name,
            "student_id": s.student_id,
            "department": s.department,
            "email": s.email,
            "image_path": s.image_path,
            "registered_at": s.registered_at.isoformat() if s.registered_at else None,
        }
        for s in rows
    ])


@app.route("/api/students/<sid>", methods=["DELETE"])
def delete_student(sid):
    student = Student.query.filter_by(student_id=sid).first()
    if student:
        db.session.delete(student)
        db.session.commit()
    # Remove face image if it exists
    img_path = os.path.join(UPLOAD_FOLDER, f"{sid}.jpg")
    if os.path.exists(img_path):
        os.remove(img_path)
    load_known_faces()
    return jsonify({"success": True, "message": f"Student {sid} removed"})


# ═════════════════════════════════════════════════════════════════════════════
#  FACE RECOGNITION API
# ═════════════════════════════════════════════════════════════════════════════

@app.route("/api/recognize", methods=["POST"])
def recognize():
    data       = request.get_json(silent=True) or {}
    image_data = data.get("image")

    if not image_data:
        return jsonify({"success": False, "message": "No image provided"}), 400

    try:
        img = decode_image(image_data)
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    except Exception as e:
        return jsonify({"success": False, "message": f"Invalid image: {e}"}), 400

    # Detect faces
    face_locs = face_recognition.face_locations(rgb, model="hog")
    if not face_locs:
        return jsonify({"success": False, "message": "No face detected in frame"}), 200

    face_encs = face_recognition.face_encodings(rgb, face_locs)

    # Snapshot of in-memory cache (thread-safe)
    with _cache_lock:
        encs_snap  = list(known_encodings)
        names_snap = list(known_names)
        ids_snap   = list(known_ids)

    results = []
    for enc in face_encs:
        if not encs_snap:
            results.append({"name": "Unknown", "confidence": 0.0})
            continue

        distances  = face_recognition.face_distance(encs_snap, enc)
        best_idx   = int(np.argmin(distances))
        confidence = round(float((1 - distances[best_idx]) * 100), 2)

        if distances[best_idx] < 0.5:          # recognised
            name = names_snap[best_idx]
            sid  = ids_snap[best_idx]

            student = Student.query.filter_by(student_id=sid).first()
            dept    = student.department if student else ""
            today   = datetime.date.today().isoformat()
            now     = datetime.datetime.now().strftime("%H:%M:%S")

            already = False
            existing = Attendance.query.filter_by(student_id=sid, date=today).first()
            if existing:
                already = True
            else:
                record = Attendance(
                    student_id=sid,
                    student_name=name,
                    department=dept,
                    date=today,
                    time=now,
                    confidence=confidence,
                )
                db.session.add(record)
                db.session.commit()

            results.append({
                "name": name, "student_id": sid, "department": dept,
                "confidence": confidence, "already_marked": already,
            })
        else:                                   # unknown
            results.append({"name": "Unknown", "confidence": confidence})

    return jsonify({"success": True, "results": results, "face_count": len(face_locs)})


# ═════════════════════════════════════════════════════════════════════════════
#  ATTENDANCE API
# ═════════════════════════════════════════════════════════════════════════════

@app.route("/api/attendance", methods=["GET"])
def get_attendance():
    date = request.args.get("date") or datetime.date.today().isoformat()
    rows = Attendance.query.filter_by(date=date).order_by(Attendance.time.desc()).all()
    return jsonify([
        {
            "id": a.id, "student_id": a.student_id, "student_name": a.student_name,
            "department": a.department, "date": a.date, "time": a.time,
            "status": a.status, "confidence": a.confidence,
        }
        for a in rows
    ])


@app.route("/api/attendance/all", methods=["GET"])
def get_all_attendance():
    rows = (Attendance.query
            .order_by(Attendance.date.desc(), Attendance.time.desc())
            .limit(500).all())
    return jsonify([
        {
            "id": a.id, "student_id": a.student_id, "student_name": a.student_name,
            "department": a.department, "date": a.date, "time": a.time,
            "status": a.status, "confidence": a.confidence,
        }
        for a in rows
    ])


@app.route("/api/stats", methods=["GET"])
def get_stats():
    today = datetime.date.today().isoformat()

    total_students = Student.query.count()
    today_present  = Attendance.query.filter_by(date=today).count()
    total_records  = Attendance.query.count()

    depts = (db.session.query(Student.department, db.func.count(Student.id).label("cnt"))
             .group_by(Student.department).all())

    weekly = []
    for i in range(7):
        d   = (datetime.date.today() - datetime.timedelta(days=i)).isoformat()
        cnt = Attendance.query.filter_by(date=d).count()
        weekly.append({"date": d, "count": cnt})

    attendance_rate = round((today_present / total_students * 100), 1) if total_students else 0.0

    return jsonify({
        "total_students":  total_students,
        "today_present":   today_present,
        "today_absent":    max(0, total_students - today_present),
        "attendance_rate": attendance_rate,
        "total_records":   total_records,
        "departments":     [{"department": d, "cnt": c} for d, c in depts],
        "weekly":          weekly,
    })


# ═════════════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)