import json
import logging
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Set

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.database import RepetitionData, SessionLocal, WorkoutSession, get_db, init_db
from app.filters import PoseStreamSmoother, check_confidence_gate
from app.kinematics import (
    MultiExerciseStateMachine,
    compute_frame_angles_and_vbt,
    calculate_1rm_and_power,
)
from app.models import (
    KinematicFeedbackResponse,
    PoseFramePayload,
    RepetitionSummaryModel,
    WorkoutSessionSummary,
)

# Initialize logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("kinematic-engine")

# Initialize database
init_db()

app = FastAPI(
    title="Kinematic Pose Estimation Engine",
    description="Real-time WebSocket math engine with One Euro temporal smoothing, 3D angle kinematics, repetition state tracking, and SQLite persistence",
    version="2.0.0"
)

# Enable CORS for local dev and tunneling (e.g. Cloudflare / local network)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ClientSessionState:
    """Encapsulates filter states, state machines, and active set memory per client connection."""
    def __init__(self, exercise_type: str = "bicep_curl"):
        self.smoother = PoseStreamSmoother()
        self.state_machine = MultiExerciseStateMachine(exercise_type=exercise_type)
        self.exercise_type = exercise_type
        self.weight_kg = 40.0
        self.is_set_active = False
        self.session_uuid = str(uuid.uuid4())
        self.set_start_time = time.time()
        self.last_quality_score = 100.0
        self.prev_joints = None
        self.prev_timestamp_ms = None

    def start_set(self, exercise_type: Optional[str] = None, weight_kg: Optional[float] = None):
        if exercise_type:
            self.exercise_type = exercise_type
        if weight_kg is not None:
            self.weight_kg = float(weight_kg)
        self.smoother.reset()
        self.state_machine.reset(exercise_type=self.exercise_type)
        self.session_uuid = str(uuid.uuid4())
        self.set_start_time = time.time()
        self.is_set_active = True
        self.last_quality_score = 100.0
        self.prev_joints = None
        self.prev_timestamp_ms = None
        logger.info(f"Started new workout set: {self.session_uuid} ({self.exercise_type}, {self.weight_kg}kg)")

    def end_set(self, db: Session) -> Optional[WorkoutSessionSummary]:
        if not self.is_set_active:
            if not self.state_machine.completed_reps:
                return None

        duration_sec = round(time.time() - self.set_start_time, 1)
        reps = self.state_machine.completed_reps
        total_reps = len(reps)

        if total_reps > 0:
            avg_quality = round(sum(r["quality_score"] for r in reps) / total_reps, 1)
        else:
            avg_quality = 100.0

        try:
            db_session = WorkoutSession(
                session_uuid=self.session_uuid,
                created_at=datetime.utcnow(),
                ended_at=datetime.utcnow(),
                exercise_type=self.exercise_type,
                total_reps=total_reps,
                overall_avg_quality=avg_quality,
                duration_seconds=duration_sec,
                weight_kg=self.weight_kg
            )
            db.add(db_session)
            db.flush()

            rep_models = []
            for r in reps:
                rep_record = RepetitionData(
                    session_id=db_session.id,
                    rep_number=r["rep_number"],
                    peak_depth_angle=r["peak_depth_angle"],
                    peak_left_elbow=r["peak_left_elbow"],
                    peak_right_elbow=r["peak_right_elbow"],
                    avg_symmetry_delta=r["avg_symmetry_delta"],
                    quality_score=r["quality_score"],
                    duration_ms=r["duration_ms"],
                    mean_velocity_mps=r.get("mean_velocity_mps", 0.0),
                    peak_velocity_mps=r.get("peak_velocity_mps", 0.0),
                    velocity_loss_pct=r.get("velocity_loss_pct", 0.0),
                    max_spine_dev=r.get("max_spine_dev", 0.0),
                    power_watts=r.get("power_watts", 0.0),
                    estimated_1rm_kg=r.get("estimated_1rm_kg", 0.0),
                    reps_in_reserve=r.get("reps_in_reserve", 0),
                    feedback_notes=r["feedback_notes"]
                )
                db.add(rep_record)
                rep_models.append(RepetitionSummaryModel(**r))

            db.commit()
            db.refresh(db_session)
            self.is_set_active = False

            return WorkoutSessionSummary(
                id=db_session.id,
                session_uuid=db_session.session_uuid,
                created_at=db_session.created_at.isoformat(),
                ended_at=db_session.ended_at.isoformat() if db_session.ended_at else None,
                exercise_type=db_session.exercise_type,
                total_reps=db_session.total_reps,
                overall_avg_quality=db_session.overall_avg_quality,
                duration_seconds=db_session.duration_seconds,
                weight_kg=db_session.weight_kg or 0.0,
                repetitions=rep_models
            )
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to persist workout session: {e}", exc_info=True)
            return None


class ConnectionManager:
    """Manages active WebSocket connections."""
    def __init__(self):
        self.active_connections: Dict[WebSocket, ClientSessionState] = {}
        self.frames_processed: int = 0
        self.start_time: float = time.time()

    async def connect(self, websocket: WebSocket) -> ClientSessionState:
        await websocket.accept()
        state = ClientSessionState()
        self.active_connections[websocket] = state
        logger.info(f"Client connected. Active count: {len(self.active_connections)}")
        return state

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            del self.active_connections[websocket]
        logger.info(f"Client disconnected. Active count: {len(self.active_connections)}")

    def increment_frame(self):
        self.frames_processed += 1


manager = ConnectionManager()


# --------------------------------------------------------------------------
# REST API Endpoints (Phase 4 & 5)
# --------------------------------------------------------------------------

@app.get("/")
async def root():
    return {
        "engine": "Kinematic Pose Estimation Backend",
        "version": "2.0.0",
        "phases_active": [1, 2, 3, 4, 5],
        "websocket_endpoint": "/ws/pose",
        "database": "SQLite (kinematic.db)"
    }


@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "uptime_seconds": round(time.time() - manager.start_time, 2),
        "active_ws_clients": len(manager.active_connections),
        "total_frames_processed": manager.frames_processed
    }


@app.get("/api/sessions", response_model=List[WorkoutSessionSummary])
def list_workout_sessions(db: Session = Depends(get_db)):
    """Fetches all completed workout sessions ordered by latest."""
    sessions = db.query(WorkoutSession).order_by(WorkoutSession.created_at.desc()).limit(30).all()
    results = []
    for s in sessions:
        reps = [
            RepetitionSummaryModel(
                rep_number=r.rep_number,
                peak_depth_angle=r.peak_depth_angle,
                peak_left_elbow=r.peak_left_elbow,
                peak_right_elbow=r.peak_right_elbow,
                avg_symmetry_delta=r.avg_symmetry_delta,
                quality_score=r.quality_score,
                duration_ms=r.duration_ms,
                mean_velocity_mps=r.mean_velocity_mps or 0.0,
                peak_velocity_mps=r.peak_velocity_mps or 0.0,
                velocity_loss_pct=r.velocity_loss_pct or 0.0,
                max_spine_dev=r.max_spine_dev or 0.0,
                power_watts=r.power_watts or 0.0,
                estimated_1rm_kg=r.estimated_1rm_kg or 0.0,
                reps_in_reserve=r.reps_in_reserve or 0,
                feedback_notes=r.feedback_notes or ""
            )
            for r in s.repetitions
        ]
        results.append(
            WorkoutSessionSummary(
                id=s.id,
                session_uuid=s.session_uuid,
                created_at=s.created_at.isoformat(),
                ended_at=s.ended_at.isoformat() if s.ended_at else None,
                exercise_type=s.exercise_type,
                total_reps=s.total_reps,
                overall_avg_quality=s.overall_avg_quality,
                duration_seconds=s.duration_seconds,
                weight_kg=getattr(s, "weight_kg", 0.0) or 0.0,
                repetitions=reps
            )
        )
    return results


@app.get("/api/sessions/latest", response_model=WorkoutSessionSummary)
def get_latest_session(db: Session = Depends(get_db)):
    """Fetches the latest completed workout session for Post-Workout Dashboard."""
    latest = db.query(WorkoutSession).order_by(WorkoutSession.created_at.desc()).first()
    if not latest:
        raise HTTPException(status_code=404, detail="No completed workout sessions found")

    reps = [
        RepetitionSummaryModel(
            rep_number=r.rep_number,
            peak_depth_angle=r.peak_depth_angle,
            peak_left_elbow=r.peak_left_elbow,
            peak_right_elbow=r.peak_right_elbow,
            avg_symmetry_delta=r.avg_symmetry_delta,
            quality_score=r.quality_score,
            duration_ms=r.duration_ms,
            mean_velocity_mps=r.mean_velocity_mps or 0.0,
            peak_velocity_mps=r.peak_velocity_mps or 0.0,
            velocity_loss_pct=r.velocity_loss_pct or 0.0,
            max_spine_dev=r.max_spine_dev or 0.0,
            power_watts=r.power_watts or 0.0,
            estimated_1rm_kg=r.estimated_1rm_kg or 0.0,
            reps_in_reserve=r.reps_in_reserve or 0,
            feedback_notes=r.feedback_notes or ""
        )
        for r in latest.repetitions
    ]

    return WorkoutSessionSummary(
        id=latest.id,
        session_uuid=latest.session_uuid,
        created_at=latest.created_at.isoformat(),
        ended_at=latest.ended_at.isoformat() if latest.ended_at else None,
        exercise_type=latest.exercise_type,
        total_reps=latest.total_reps,
        overall_avg_quality=latest.overall_avg_quality,
        duration_seconds=latest.duration_seconds,
        weight_kg=getattr(latest, "weight_kg", 0.0) or 0.0,
        repetitions=reps
    )


@app.get("/api/sessions/{session_id}", response_model=WorkoutSessionSummary)
def get_session_by_id(session_id: int, db: Session = Depends(get_db)):
    """Fetches a specific workout session with repetition data."""
    s = db.query(WorkoutSession).filter(WorkoutSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Workout session not found")

    reps = [
        RepetitionSummaryModel(
            rep_number=r.rep_number,
            peak_depth_angle=r.peak_depth_angle,
            peak_left_elbow=r.peak_left_elbow,
            peak_right_elbow=r.peak_right_elbow,
            avg_symmetry_delta=r.avg_symmetry_delta,
            quality_score=r.quality_score,
            duration_ms=r.duration_ms,
            mean_velocity_mps=r.mean_velocity_mps or 0.0,
            peak_velocity_mps=r.peak_velocity_mps or 0.0,
            velocity_loss_pct=r.velocity_loss_pct or 0.0,
            max_spine_dev=r.max_spine_dev or 0.0,
            power_watts=r.power_watts or 0.0,
            estimated_1rm_kg=r.estimated_1rm_kg or 0.0,
            reps_in_reserve=r.reps_in_reserve or 0,
            feedback_notes=r.feedback_notes or ""
        )
        for r in s.repetitions
    ]

    return WorkoutSessionSummary(
        id=s.id,
        session_uuid=s.session_uuid,
        created_at=s.created_at.isoformat(),
        ended_at=s.ended_at.isoformat() if s.ended_at else None,
        exercise_type=s.exercise_type,
        total_reps=s.total_reps,
        overall_avg_quality=s.overall_avg_quality,
        duration_seconds=s.duration_seconds,
        weight_kg=getattr(s, "weight_kg", 0.0) or 0.0,
        repetitions=reps
    )


# --------------------------------------------------------------------------
# WebSocket Pipeline (Phases 1, 2, 3, 4)
# --------------------------------------------------------------------------

async def handle_pose_stream(websocket: WebSocket):
    client_state = await manager.connect(websocket)
    db = SessionLocal()

    try:
        while True:
            raw_text = await websocket.receive_text()
            t_recv = time.time() * 1000

            try:
                data_dict = json.loads(raw_text)
                event_name = data_dict.get("event")

                # Handle Set Lifecycle Events (Phase 4)
                if event_name == "start_set":
                    target_ex = data_dict.get("exercise_type", client_state.exercise_type)
                    target_weight = float(data_dict.get("weight_kg", client_state.weight_kg) or 40.0)
                    client_state.start_set(target_ex, target_weight)
                    await websocket.send_text(json.dumps({
                        "event": "set_started",
                        "session_uuid": client_state.session_uuid,
                        "exercise_type": client_state.exercise_type,
                        "weight_kg": client_state.weight_kg,
                        "timestamp_ms": t_recv
                    }))
                    continue

                elif event_name == "end_set":
                    summary = client_state.end_set(db)
                    await websocket.send_text(json.dumps({
                        "event": "set_completed",
                        "session_summary": summary.model_dump() if summary else None,
                        "timestamp_ms": t_recv
                    }))
                    continue

                elif data_dict.get("type") == "ping":
                    await websocket.send_text(json.dumps({
                        "type": "pong",
                        "server_timestamp_ms": t_recv
                    }))
                    continue

                # Ingest coordinate payload
                payload = PoseFramePayload(**data_dict)
                manager.increment_frame()

                if payload.exercise_type and payload.exercise_type != client_state.exercise_type:
                    client_state.exercise_type = payload.exercise_type
                    client_state.state_machine.exercise_type = payload.exercise_type
                    client_state.state_machine.is_squat = (payload.exercise_type == "squat")

                raw_joints = payload.key_joints or {}

                # 1. Exercise-Specific Confidence Gate (Phase 3 Objective 2)
                ex_name = client_state.exercise_type.lower()
                if ex_name in ["squat", "lunge"]:
                    critical_keys = ["left_knee", "right_knee", "left_hip", "right_hip"]
                elif ex_name == "deadlift":
                    critical_keys = ["left_hip", "right_hip", "left_knee", "right_knee", "left_shoulder", "right_shoulder"]
                elif ex_name == "plank":
                    critical_keys = ["left_shoulder", "right_shoulder", "left_hip", "right_hip"]
                else:  # bicep_curl, overhead_press, push_up, lateral_raise, bent_over_row
                    critical_keys = ["left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_shoulder", "right_shoulder"]

                is_valid, compromised, gate_msg = check_confidence_gate(
                    raw_joints,
                    critical_joints=critical_keys,
                    threshold=0.65
                )

                if not is_valid:
                    # Confidence gate triggered: pause scoring & state machine without penalizing user
                    t_finish = time.time() * 1000
                    response = KinematicFeedbackResponse(
                        frame_index=payload.frame_index,
                        client_timestamp_ms=payload.client_timestamp_ms,
                        server_timestamp_ms=round(t_finish, 2),
                        processing_time_ms=round(t_finish - t_recv, 2),
                        quality_score=client_state.last_quality_score,  # hold previous score
                        status="visibility_warning",
                        active_exercise=client_state.exercise_type,
                        detected_joints_count=len(raw_joints),
                        message=gate_msg,
                        rep_phase=client_state.state_machine.current_phase,
                        rep_count=client_state.state_machine.rep_count,
                        angles={},
                        visibility_error=True,
                        compromised_joints=compromised,
                        session_uuid=client_state.session_uuid,
                        is_set_active=client_state.is_set_active
                    )
                    await websocket.send_text(response.model_dump_json())
                    continue

                # 2. Temporal Smoothing Filter (Phase 3 Objective 1: One Euro Filter)
                smoothed_joints = client_state.smoother.smooth_joints(
                    raw_joints,
                    timestamp_s=payload.client_timestamp_ms / 1000.0
                )

                # 3. Vector Angle Kinematics & VBT Velocity Computation
                dt_sec = 0.04
                if client_state.prev_timestamp_ms:
                    dt_sec = max(0.01, min(0.2, (payload.client_timestamp_ms - client_state.prev_timestamp_ms) / 1000.0))

                angles, vbt = compute_frame_angles_and_vbt(
                    smoothed_joints, client_state.prev_joints, dt_sec, exercise_type=client_state.exercise_type
                )
                client_state.prev_joints = smoothed_joints
                client_state.prev_timestamp_ms = payload.client_timestamp_ms

                # 4. Multi-Exercise Repetition State Machine & Sports Science VBT Engine
                weight_val = getattr(payload, "weight_kg", 0.0) or client_state.weight_kg or 40.0
                client_state.weight_kg = weight_val
                current_phase, completed_rep, live_score, extra_metrics = client_state.state_machine.update(
                    angles, vbt, weight_kg=weight_val, dt_sec=dt_sec
                )
                client_state.last_quality_score = live_score
                sports_calc = calculate_1rm_and_power(weight_val, vbt.get("wrist_velocity_mps", 0.0), client_state.exercise_type)

                # Formulate status message
                if completed_rep:
                    status_msg = f"Rep #{completed_rep['rep_number']} Done ({completed_rep['quality_score']}%) | VBT: {completed_rep.get('mean_velocity_mps', 0.0)}m/s | 1RM: {completed_rep.get('estimated_1rm_kg', 0.0)}kg"
                else:
                    sym_val = angles.get('symmetry_delta', 0.0)
                    status_msg = f"Phase: {current_phase} | Delta {sym_val} deg | VBT: {vbt.get('wrist_velocity_mps', 0.0)}m/s"

                t_finish = time.time() * 1000
                proc_time_ms = round(t_finish - t_recv, 2)

                response = KinematicFeedbackResponse(
                    frame_index=payload.frame_index,
                    client_timestamp_ms=payload.client_timestamp_ms,
                    server_timestamp_ms=round(t_finish, 2),
                    processing_time_ms=proc_time_ms,
                    quality_score=live_score,
                    status="ok",
                    active_exercise=client_state.exercise_type,
                    detected_joints_count=len(smoothed_joints),
                    message=status_msg,
                    rep_phase=current_phase,
                    rep_count=client_state.state_machine.rep_count,
                    angles=angles,
                    last_rep=RepetitionSummaryModel(**completed_rep) if completed_rep else None,
                    vbt=vbt,
                    injury_risk=extra_metrics.get("injury_risk", "LOW"),
                    power_watts=sports_calc["power_watts"],
                    estimated_1rm_kg=sports_calc["estimated_1rm_kg"],
                    reps_in_reserve=sports_calc["reps_in_reserve"],
                    visibility_error=False,
                    compromised_joints=[],
                    session_uuid=client_state.session_uuid,
                    is_set_active=client_state.is_set_active
                )

                await websocket.send_text(response.model_dump_json())

            except ValidationError as ve:
                logger.warning(f"Validation error: {ve.errors()}")
                await websocket.send_text(json.dumps({"status": "error", "error": str(ve.errors())}))
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"status": "error", "error": "Invalid JSON"}))
            except Exception as e:
                logger.error(f"Error processing frame: {e}", exc_info=True)
                await websocket.send_text(json.dumps({"status": "error", "error": str(e)}))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
    finally:
        db.close()


@app.websocket("/ws/pose")
async def websocket_pose_endpoint(websocket: WebSocket):
    await handle_pose_stream(websocket)


@app.websocket("/ws")
async def websocket_alias_endpoint(websocket: WebSocket):
    await handle_pose_stream(websocket)
