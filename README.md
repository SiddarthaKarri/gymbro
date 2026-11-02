# Kinematic Pose Estimation Engine for Resistance Training
**Comprehensive Biomechanical Telemetry & Form Degradation Analytics System**

An end-to-end computer vision and biomechanical analysis engine designed to track, score, and analyze exercise form degradation across repetitions during resistance training (Squats, Bicep Curls, Overhead Presses).

---

## Architecture Overview

```
 ┌────────────────────────────────────────────────────────┐
 │                   Browser (React)                      │
 │  ┌─────────────────┐       ┌────────────────────────┐  │
 │  │ Webcam / Mock   │ ───>  │ MediaPipe (BlazePose)  │  │
 │  └─────────────────┘       └───────────┬────────────┘  │
 │                                        │               │
 │                             Extract 3D Coordinates     │
 │                       (Shoulders, Elbows, Wrists, Hips)│
 │                                        │               │
 │  ┌─────────────────┐       ┌───────────▼────────────┐  │
 │  │ HTML5 Canvas    │ <───  │ Client Throttler       │  │
 │  │ Biomechanic HUD │       │ (~25 FPS Stream)       │  │
 │  └─────────────────┘       └───────────┬────────────┘  │
 └────────────────────────────────────────┼───────────────┘
                                          │
                   WebSocket (JSON @ ~25 FPS, Sub-2ms RTT)
                   ws://127.0.0.1:8000/ws/pose
                                          │
 ┌────────────────────────────────────────▼───────────────┐
 │                Python Backend (FastAPI)                │
 │  ┌──────────────────────────────────────────────────┐  │
 │  │ 1. Confidence Gate (Landmark visibility >= 0.65) │  │
 │  │ 2. One Euro Temporal Filter (Adaptive smoothing) │  │
 │  │ 3. NumPy 3D Vector Math (Joint Angles & Symmetry)│  │
 │  │ 4. Repetition State Machine (Lockout/Flex/Pause) │  │
 │  │ 5. Heuristic Quality Scoring (Depth & Delta)     │  │
 │  │ 6. SQLite Database (SQLAlchemy Persistence)      │  │
 │  └──────────────────────────────────────────────────┘  │
 └────────────────────────────────────────────────────────┘
                                          │
                   REST API (Historical Post-Set Analysis)
                   GET /api/sessions/latest
                                          │
 ┌────────────────────────────────────────▼───────────────┐
 │       Post-Workout Analytics Dashboard (Recharts)      │
 │  - Form Degradation Line Chart (Quality % vs Rep #)    │
 │  - Bilateral Symmetry Delta Chart (|Left - Right| ≤ 5°)│
 │  - Repetition Breakdown Table & Kinematic Telemetry    │
 └────────────────────────────────────────────────────────┘
```

---

## Implemented Phases

### Phase 1: High-Performance Ingestion Pipeline
- Local BlazePose Lite model and WebAssembly runtime bundled in `frontend/public/` (offline-capable).
- Throttled ~25 FPS streaming via low-latency WebSockets.
- Mirrored video feed with glowing wireframe canvas overlay and center-of-gravity plumb line.

### Phase 2: Kinematic Vector Math & Repetition State Machine
- **NumPy 3D Vector Dot Products**: Calculates elbow angle ($\vec{BA} \cdot \vec{BC}$ between shoulder, elbow, and wrist), shoulder abduction, and knee angles.
- **Repetition State Machine**: Continuous phase tracking:
  `LOCKOUT` $\rightarrow$ `CONCENTRIC` $\rightarrow$ `BOTTOM_PAUSE` $\rightarrow$ `ECCENTRIC` $\rightarrow$ `LOCKOUT`.
- **Scoring Heuristic**:
  - Full 100% Quality achieved when depth breaks 90° ($< 90^\circ$) and bilateral symmetry delta $\le 5.0^\circ$.
  - Proportional percentage penalties applied for short ROM ($1.5\% / ^\circ$) and asymmetry ($2.0\% / ^\circ$).

### Phase 3: Temporal Smoothing & Confidence Gate
- **One Euro Filter**: 3D adaptive low-pass filter eliminates coordinate jitter during slow movements while maintaining sub-millisecond responsiveness during explosive reps.
- **Confidence Gate**: Real-time inspection of MediaPipe landmark visibility. If any critical joint drops below $0.65$:
  - Pauses the scoring engine without penalizing the athlete.
  - Flashes a high-visibility canvas warning overlay.
  - Highlights the compromised joint in glowing red on the wireframe.

### Phase 4: Session State & Database Architecture
- **SQLAlchemy + SQLite** (`backend/kinematic.db`):
  - `WorkoutSession`: Stores session UUID, timestamp, exercise type, total reps, average quality score, and duration.
  - `RepetitionData`: Stores rep number, peak depth angle, left/right elbow angles, average symmetry delta, quality score, duration, and biomechanical feedback notes.
- **Set Lifecycle Controls**: "Start Workout Set" and "Finish & Analyze Set" triggers over WebSocket with persistent SQLite commit.

### Phase 5: Post-Workout Analytics & Data Visualization
- **React Post-Workout Dashboard**:
  - Dynamically queries `GET /api/sessions/latest` and `GET /api/sessions` via standard REST API.
  - **Form Degradation Line Chart**: Visualizes quality score breakdown across repetitions to expose muscular fatigue.
  - **Symmetry Delta Bar Chart**: Visualizes bilateral balance against the 5° threshold.
  - **Repetition-by-Repetition Telemetry Table**: Full inspection of every individual rep.

---

## Directory Structure

```
kinematic/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py        # SQLAlchemy models (WorkoutSession, RepetitionData)
│   │   ├── filters.py         # One Euro Filter & Confidence Gate logic
│   │   ├── kinematics.py      # NumPy 3D angle math & RepetitionStateMachine
│   │   ├── main.py            # FastAPI app, WebSocket handlers, and REST API
│   │   └── models.py          # Pydantic schemas for telemetry and session stats
│   ├── kinematic.db           # SQLite database
│   ├── requirements.txt       # fastapi, uvicorn, websockets, numpy, pydantic, sqlalchemy
│   └── run.py                 # Backend runner
│
├── frontend/
│   ├── public/
│   │   ├── models/            # BlazePose model weights
│   │   └── wasm/              # MediaPipe WebAssembly binaries
│   ├── src/
│   │   ├── components/
│   │   │   ├── PoseCanvas.jsx           # Canvas with red confidence warnings & phase overlays
│   │   │   ├── TelemetryHUD.jsx         # Live telemetry HUD with rep state machine
│   │   │   └── PostWorkoutDashboard.jsx # Recharts Form Degradation & Symmetry charts
│   │   ├── hooks/
│   │   │   ├── usePoseDetection.js      # BlazePose video inference loop
│   │   │   └── useKinematicWebSocket.js # Set lifecycle, 25 FPS stream, & RTT tracker
│   │   ├── utils/
│   │   │   ├── drawing.js     # Biomechanical joint connectors & warning states
│   │   │   └── mockPose.js    # Synthetic kinematic simulator for zero-camera testing
│   │   ├── App.jsx            # Mode tab switcher (Live HUD <-> Post-Set Analytics)
│   │   ├── index.css          # Biomechanical dark HUD stylesheet
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js         # Proxy configuration for /api and /ws
│
├── test_phases_2_to_5.py      # End-to-end automated test script
├── test_stream.py             # Phase 1 benchmark script
└── README.md
```

---

## Quickstart Instructions

### 1. Launch the FastAPI Backend
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Health Check:* [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)  
*REST API Sessions:* [http://127.0.0.1:8000/api/sessions/latest](http://127.0.0.1:8000/api/sessions/latest)  
*WebSocket:* `ws://127.0.0.1:8000/ws/pose`

### 2. Launch the React Frontend
```bash
cd frontend
bun run dev
# or: npm run dev
```
Open **[http://127.0.0.1:5173](http://127.0.0.1:5173)** in your browser.

---

## Verification & Testing

To run the automated verification suite covering all 5 phases:
```bash
python test_phases_2_to_5.py
```
Outputs validation for:
1. `start_set` and `end_set` WebSocket lifecycle.
2. Perfect rep detection (breaks 90°, symmetry delta < 5°).
3. Confidence Gate trigger (< 0.65 visibility).
4. Partial ROM depth penalty calculation.
5. SQLite session aggregation & REST API ingestion.
