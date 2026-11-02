from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
import time

class Point3D(BaseModel):
    x: float
    y: float
    z: float
    visibility: Optional[float] = Field(default=None, description="Landmark visibility [0, 1]")
    presence: Optional[float] = Field(default=None, description="Landmark presence score [0, 1]")


class PoseFramePayload(BaseModel):
    event: Optional[str] = Field(default=None, description="Control event: 'start_set' | 'end_set' | 'reset'")
    frame_index: int = Field(default=0, description="Sequential frame index")
    client_timestamp_ms: float = Field(default_factory=lambda: time.time() * 1000)
    exercise_type: str = Field(default="bicep_curl", description="Resistance exercise type")
    weight_kg: float = Field(default=0.0, description="Working resistance load in kilograms")
    key_joints: Optional[Dict[str, Point3D]] = Field(default=None)
    landmarks: Optional[List[Point3D]] = Field(default=None)
    world_landmarks: Optional[List[Point3D]] = Field(default=None)


class RepetitionSummaryModel(BaseModel):
    rep_number: int
    peak_depth_angle: float
    peak_left_elbow: float
    peak_right_elbow: float
    avg_symmetry_delta: float
    quality_score: float
    duration_ms: float
    mean_velocity_mps: float = 0.0
    peak_velocity_mps: float = 0.0
    velocity_loss_pct: float = 0.0
    max_spine_dev: float = 0.0
    power_watts: float = 0.0
    estimated_1rm_kg: float = 0.0
    reps_in_reserve: int = 0
    feedback_notes: str


class KinematicFeedbackResponse(BaseModel):
    frame_index: int
    client_timestamp_ms: float
    server_timestamp_ms: float
    processing_time_ms: float
    quality_score: float = Field(..., description="Real-time Form Quality Score [0 - 100]")
    status: str = "ok"
    active_exercise: str
    detected_joints_count: int
    message: str

    # Movement Phases & Joint Angles
    rep_phase: str = Field(default="LOCKOUT", description="Movement phase: LOCKOUT, CONCENTRIC, BOTTOM_PAUSE, ECCENTRIC")
    rep_count: int = Field(default=0, description="Completed repetition count")
    angles: Dict[str, float] = Field(default_factory=dict, description="Live 3D joint angles in degrees")
    last_rep: Optional[RepetitionSummaryModel] = Field(default=None, description="Summary of last completed repetition")

    # VBT, Power & 1RM
    vbt: Dict[str, float] = Field(default_factory=dict, description="Velocity-based training telemetry")
    injury_risk: str = Field(default="LOW", description="Real-time spine & valgus risk index (LOW, MODERATE, HIGH)")
    power_watts: float = Field(default=0.0, description="Instantaneous mechanical power in Watts (F x v)")
    estimated_1rm_kg: float = Field(default=0.0, description="Sports-science estimated One-Rep Maximum")
    reps_in_reserve: int = Field(default=0, description="Estimated Reps In Reserve (RIR)")

    # Temporal Smoothing & Confidence Gate
    visibility_error: bool = Field(default=False, description="True if critical joints fall below confidence threshold")
    compromised_joints: List[str] = Field(default_factory=list, description="List of joints failing confidence gate (<0.65)")

    # Session Tracking
    session_uuid: Optional[str] = Field(default=None, description="Active workout session UUID")
    is_set_active: bool = Field(default=False, description="True if a workout set is actively running")


class WorkoutSessionSummary(BaseModel):
    id: int
    session_uuid: str
    created_at: str
    ended_at: Optional[str]
    exercise_type: str
    total_reps: int
    overall_avg_quality: float
    duration_seconds: float
    weight_kg: float = 0.0
    repetitions: List[RepetitionSummaryModel] = []
