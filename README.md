# Examination Management Portal (EMP - V2)

A full-stack, role-based web application for managing academic examinations, examiner slot allocations, student bookings, rubric-driven assessments, and asynchronous background jobs.

---

## 🛠 Frameworks & Tech Stack

This project strictly adheres to the mandatory framework guidelines:

| Layer | Technology | Description |
|---|---|---|
| **API Backend** | **Flask (Python 3.13)** | RESTful API with Flask-SQLAlchemy, Flask-CORS, and PyJWT |
| **Frontend UI** | **Vue.js 3** | Responsive Single Page Application with modular components and reactive state |
| **Entry Point** | **Jinja2 Template** | Minimal `index.html` entry point serving the Vue.js SPA |
| **Styling** | **Bootstrap 5.3** | HTML layout, responsive grids, and UI styling (no other CSS framework used) |
| **Icons & Analytics** | **Bootstrap Icons & Chart.js** | Visual indicators and interactive charts for admin analytics |
| **Database** | **SQLite** (`instance/emp.db`) | Programmatically generated via SQLAlchemy ORM (no manual tools allowed) |
| **Caching** | **Redis** | High-throughput caching for examinations, schedules, rubrics, and dashboard stats |
| **Background Jobs** | **Celery + Redis** | Asynchronous batch task execution and periodic scheduled jobs |
| **PDF Generation** | **ReportLab** | Generates official student scorecards and monthly administrative reports |

---

## 👥 Roles & Functionalities

### 1. Administrator (Pre-existing Superuser)
* **Single Super Admin**: Created programmatically upon database initialization (`admin` / `admin123`). Registration disabled for admin.
* **Dashboard & Metrics**:
  * Real-time metrics: Total courses, examinations, students, examiners, slots, and bookings.
  * **Chart.js Analytics**: Popular examinations by booking volume, examiner workload (slots vs evaluations), and booking status distribution.
* **Courses Management**: Create, view, update, and remove academic courses.
* **Examinations Management**:
  * Configure examinations (type, duration, maximum marks, timeline dates).
  * Configure timelines: Slot creation start/end dates and student booking start/end dates.
  * Manually open/close slot creation and student booking.
  * Assign examiners to examinations.
  * Publish examination results to students with automatic in-app alerts.
* **Rubrics Management**: Create, edit, and delete evaluation criteria with customizable weightages and maximum marks.
* **Examiners Management**: Provision new examiner faculty accounts (examiners cannot self-register).
* **Students Management**: Review registered students and toggle account active/inactive status.
* **Slots & Bookings Overview**:
  * Monitor all slots and bookings across departments.
  * **Reschedule Bookings**: Move student bookings to alternate available slots in exceptional situations with recorded reason.
  * **Reassign Examiners**: Change assigned examiner for slots.
* **Global Search**: Search students, examiners, examinations, and bookings across the portal.
* **Periodic & On-Demand Monthly Report**: Trigger and review Celery monthly reports with downloadable PDF output.

### 2. Examiner (Faculty Member)
* **Authentication**: Login only using credentials provisioned by Admin.
* **Dashboard**:
  * Assigned examinations list.
  * Slot creation status indicators.
  * Created examination slots.
  * Booked student count and pending evaluations tracker.
* **Slot Management**:
  * Create slots strictly during the designated **Slot Creation Period**.
  * Edit or delete slots before student booking commences.
  * Specify start/end times, maximum capacity, venue, and meeting links (Google Meet/Zoom).
  * Mark slots as completed.
* **Evaluation & Rubrics**:
  * View booked students for each slot.
  * Evaluate candidate performance against predefined examination rubrics.
  * Criterion-wise scoring, dynamic total calculation, and feedback entry.
  * Submit marks and comprehensive examiner remarks.

### 3. Student (Candidate)
* **Authentication**: Self-registration with Roll Number, Department, and Contact. Login and profile management.
* **Dashboard**:
  * Available examinations with booking period status.
  * Upcoming booked examinations with direct meeting links.
  * Published examination results snapshot.
* **Examination Discovery**: Search and filter by course code, exam type (Viva, Practical, Project Demo, Assessment), and status.
* **Slot Booking**:
  * View available slots for examinations with open booking windows.
  * Book available slot (prevents duplicate bookings for the same exam and prevents overbooking beyond seat capacity).
  * Cancel bookings before the booking deadline (automatically frees slot capacity).
* **Results & Scorecards**:
  * View published marks, pass/fail status, rubric breakdown, and examiner feedback.
  * Download official examination scorecard as a generated PDF (`/api/common/scorecard/<id>/pdf`).
* **Async CSV Export (Celery Batch Job)**:
  * Trigger asynchronous batch export of complete examination history.
  * Status polling and one-click download for generated CSV.

---

## ⚡ Background Jobs (Celery & Redis)

1. **Scheduled Job – Daily Examination Reminder**:
   * Scans bookings scheduled for the next 24–48 hours.
   * Dispatches examination details (exam name, date/time, assigned examiner, meeting link, instructions).
   * Scheduled daily at 8:00 AM via Celery Beat (`app.tasks.send_daily_reminders`).
2. **Scheduled Job – Monthly Examination Report**:
   * Aggregates monthly exam metrics: Conducted exams, evaluated candidates, completed bookings, pending evaluations, and most active examiners.
   * Generates both an HTML summary and a ReportLab PDF report saved in `exports/`.
   * Scheduled for the 1st of every month at midnight via Celery Beat (`app.tasks.generate_monthly_report`). Also triggerable on-demand from the Admin dashboard.
3. **User-Triggered Async Job – Export Examination History as CSV**:
   * Triggered from Student dashboard (`app.tasks.export_student_history_csv`).
   * Generates CSV with: `Student ID`, `Student Name`, `Roll Number`, `Examination Name`, `Course Code`, `Course Name`, `Examination Date`, `Slot Time`, `Examiner Name`, `Marks Obtained`, `Maximum Marks`, `Booking Status`, `Remarks`.

---

## 🚀 Performance & Redis Caching

Redis caches frequently accessed resources with automatic cache expiration and invalidation:
* `admin:stats` (180s TTL) – Dashboard metrics and analytics.
* `exams:all` (300s TTL) – Complete examinations catalog.
* `schedules:<exam_id>` (120s TTL) – Available slots schedule.
* `rubrics:<exam_id>` (300s TTL) – Examination rubric criteria.

Cache invalidation occurs automatically on any create, update, delete, or booking action.

---

## 🔑 Demo User Credentials

The application initializes programmatic seed data upon startup with pre-configured accounts:

| Role | Username | Password | Details |
|---|---|---|---|
| **Admin** | `admin` | `admin123` | System Administrator |
| **Examiner** | `prof_sharma` | `examiner123` | Prof. Ram Sharma (CS) |
| **Examiner** | `dr_anita` | `examiner123` | Dr. Anita Verma (CS) |
| **Student** | `student1` | `student123` | Aarav Mehta (Roll: 21CSS001) |
| **Student** | `student2` | `student123` | Priya Patel (Roll: 21CSS002) |


---

## 📁 Directory Structure

```text
mad2sept/
├── backend/                  # ALL BACKEND CODE
│   ├── app/
│   │   ├── __init__.py       # Flask app factory (serves frontend folder & APIs)
│   │   ├── config.py         # App configuration & environment constants
│   │   ├── models.py         # SQLAlchemy unified models (User, Exam, Rubric, Slot, etc.)
│   │   ├── database.py       # Programmatic DB initialization & demo seeding
│   │   ├── auth_helper.py    # JWT Bearer token generation & role decorators
│   │   ├── redis_client.py   # Redis caching client with invalidation & TTL
│   │   ├── celery_app.py     # Celery instance & periodic Beat crontabs
│   │   ├── tasks.py          # Celery tasks (reminders, monthly report, CSV export)
│   │   └── routes/           # REST API Blueprints
│   │       ├── auth.py       # Login, Student self-registration, Profile
│   │       ├── admin.py      # Courses, Exams, Rubrics, Overrides, Analytics
│   │       ├── examiner.py   # Slots management & Rubric evaluations
│   │       ├── student.py    # Browse, Book slots, Cancel, Async CSV export
│   │       └── common.py     # Global search, Notifications, PDF Scorecards
│   ├── instance/
│   │   └── emp.db            # SQLite database file (created programmatically)
│   ├── exports/              # Generated CSVs and PDF reports
│   ├── run.py                # Flask server entry point
│   ├── worker.py             # Celery worker runner (macOS solo pool supported)
│   ├── beat.py               # Celery Beat scheduler
│   └── requirements.txt      # Python dependencies
│
├── frontend/                 # ALL FRONTEND CODE
│   ├── index.html            # Main Single-Page Application HTML entry point
│   ├── manifest.json         # PWA Add to Desktop manifest
│   ├── css/
│   │   └── style.css         # Modern Bootstrap extensions & aesthetics
│   └── js/
│       ├── api.js            # Centralized API service with JWT authentication
│       ├── app.js            # Root Vue 3 application controller
│       └── components/       # Modular Vue 3 components
│           ├── Navbar.js             # Navigation bar with role badges & alerts
│           ├── AuthModal.js          # Login & Student registration dialog
│           ├── AdminDashboard.js     # Admin metrics, CRUD, and Chart.js analytics
│           ├── ExaminerDashboard.js  # Examiner slot creator & rubric scoring
│           ├── StudentDashboard.js   # Student booking, scorecards & CSV export
│           ├── ProfileModal.js       # User profile & password modal
│           └── GlobalSearch.js       # Global search modal across the portal
└── README.md
```

---

## 💻 Local Setup & Execution Guide

### Prerequisites
* Python 3.10+
* Redis server installed (`brew install redis` on macOS or `sudo apt install redis` on Ubuntu)

### Step 1: Virtual Environment Setup
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### Step 2: Ensure Redis Server is Running
```bash
redis-server
# Verify connection
redis-cli ping  # Output: PONG
```

### Step 3: Run the Application Components

#### Terminal 1: Run the Flask Web Application
```bash
cd backend
source venv/bin/activate
python3 run.py
```
The application will start on **`http://127.0.0.1:5001`**. The Flask server automatically serves both the frontend SPA and the backend REST API endpoints.

#### Optional Frontend Dev Server (Vite)
If you prefer running a dedicated frontend development server with live reload:
```bash
cd frontend
npm install
npm run dev
```
This opens **`http://localhost:5173`**, with requests to `/api` automatically proxied to Flask on port 5001.

#### Terminal 2: Run the Celery Worker
```bash
cd backend
source venv/bin/activate
python3 worker.py
```

#### Terminal 3: Run the Celery Beat Scheduler (Periodic Tasks)
```bash
cd backend
source venv/bin/activate
python3 beat.py
```

---

## 📱 Additional Features
* **Add to Desktop (PWA Manifest)**: Progressive Web App manifest enabled with "Add to Desktop" button on the navigation bar.
* **Official PDF Scorecards**: Students can download scorecards formatted with evaluation rubrics and examiner remarks.
* **Notification System**: Live polling for notifications (slot confirmations, schedule changes, result publications).

