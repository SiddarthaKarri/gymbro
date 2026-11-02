import math
import time
from typing import Dict, List, Optional, Tuple, Any
import numpy as np
from app.models import Point3D


def calculate_3d_angle(
    a: Tuple[float, float, float],
    b: Tuple[float, float, float],
    c: Tuple[float, float, float]
) -> float:
    """
    Calculates the 3D joint angle in degrees at vertex B using vector dot product.
    Angle between BA and BC:
    cos(theta) = (BA . BC) / (||BA|| * ||BC||)
    """
    v_ba = np.array(a, dtype=np.float64) - np.array(b, dtype=np.float64)
    v_bc = np.array(c, dtype=np.float64) - np.array(b, dtype=np.float64)

    norm_ba = np.linalg.norm(v_ba)
    norm_bc = np.linalg.norm(v_bc)

    if norm_ba < 1e-6 or norm_bc < 1e-6:
        return 0.0

    cosine_angle = np.dot(v_ba, v_bc) / (norm_ba * norm_bc)
    cosine_angle = np.clip(cosine_angle, -1.0, 1.0)

    angle_rad = np.arccos(cosine_angle)
    return round(float(np.degrees(angle_rad)), 1)


def calculate_1rm_and_power(
    weight_kg: float,
    mean_velocity_mps: float,
    exercise_type: str = "bicep_curl"
) -> Dict[str, float]:
    """
    Predicts 1RM and peak mechanical power output using sports science linear regression equations
    (González-Badillo & Sánchez-Medina, 2010; J Strength Cond Res).
    """
    if weight_kg <= 0 or mean_velocity_mps <= 0.05:
        return {
            "estimated_1rm_kg": round(weight_kg, 1),
            "power_watts": 0.0,
            "reps_in_reserve": 0,
            "pct_1rm": 0.0
        }

    # Exercise-specific Minimal Velocity Threshold (MVT) at 1RM
    mvt_map = {
        "bicep_curl": 0.22,
        "squat": 0.30,
        "deadlift": 0.15,
        "overhead_press": 0.19,
        "ohp": 0.19,
        "push_up": 0.20,
        "lateral_raise": 0.25,
        "lunge": 0.28,
        "bent_over_row": 0.25,
        "plank": 0.0
    }
    mvt = mvt_map.get(exercise_type, 0.20)

    # % 1RM from MCV linear profile: %1RM = -59.53 * MCV + 112.5 (standardized)
    pct_1rm = max(35.0, min(98.0, 112.5 - (59.53 * mean_velocity_mps)))
    est_1rm = round(weight_kg / (pct_1rm / 100.0), 1)

    # Mechanical Power (Watts) = Force * Velocity = (m * g) * v
    g = 9.80665
    power_w = round(weight_kg * g * mean_velocity_mps, 1)

    # Reps in Reserve (RIR) estimate based on velocity reserve above MVT
    vel_reserve = max(0.0, mean_velocity_mps - mvt)
    rir = int(min(6, max(0, round(vel_reserve / 0.08))))

    return {
        "estimated_1rm_kg": est_1rm,
        "power_watts": power_w,
        "reps_in_reserve": rir,
        "pct_1rm": round(pct_1rm, 1)
    }


def compute_frame_angles_and_vbt(
    joints: Dict[str, Point3D],
    prev_joints: Optional[Dict[str, Point3D]] = None,
    dt_sec: float = 0.04,
    exercise_type: str = "bicep_curl"
) -> Tuple[Dict[str, float], Dict[str, float]]:
    """
    Calculates primary resistance training joint angles, 3D spine alignment,
    knee valgus deviation, and Velocity-Based Training (VBT) instantaneous velocity.
    """
    def pt(name: str) -> Optional[Tuple[float, float, float]]:
        p = joints.get(name)
        return (p.x, p.y, p.z) if p else None

    def prev_pt(name: str) -> Optional[Tuple[float, float, float]]:
        if not prev_joints:
            return None
        p = prev_joints.get(name)
        return (p.x, p.y, p.z) if p else None

    l_shl, r_shl = pt("left_shoulder"), pt("right_shoulder")
    l_elb, r_elb = pt("left_elbow"), pt("right_elbow")
    l_wrs, r_wrs = pt("left_wrist"), pt("right_wrist")
    l_hip, r_hip = pt("left_hip"), pt("right_hip")
    l_kne, r_kne = pt("left_knee"), pt("right_knee")
    l_ank, r_ank = pt("left_ankle"), pt("right_ankle")
    nose = pt("nose")

    angles: Dict[str, float] = {
        "left_elbow": 180.0,
        "right_elbow": 180.0,
        "left_shoulder_abduction": 0.0,
        "right_shoulder_abduction": 0.0,
        "left_knee": 180.0,
        "right_knee": 180.0,
        "left_hip_hinge": 180.0,
        "right_hip_hinge": 180.0,
        "spine_angle": 180.0,
        "knee_valgus_delta": 0.0,
        "symmetry_delta": 0.0,
        "elbow_symmetry_delta": 0.0,
        "knee_symmetry_delta": 0.0,
        "shoulder_symmetry_delta": 0.0,
        "hip_symmetry_delta": 0.0,
        "torso_inclination": 0.0,
    }

    # 1. Elbow Angles (Shoulder -> Elbow -> Wrist)
    if l_shl and l_elb and l_wrs:
        angles["left_elbow"] = calculate_3d_angle(l_shl, l_elb, l_wrs)
    if r_shl and r_elb and r_wrs:
        angles["right_elbow"] = calculate_3d_angle(r_shl, r_elb, r_wrs)

    # 2. Shoulder Abduction Angles (Hip -> Shoulder -> Elbow)
    if l_hip and l_shl and l_elb:
        angles["left_shoulder_abduction"] = calculate_3d_angle(l_hip, l_shl, l_elb)
    if r_hip and r_shl and r_elb:
        angles["right_shoulder_abduction"] = calculate_3d_angle(r_hip, r_shl, r_elb)

    # 3. Knee Angles (Hip -> Knee -> Ankle)
    if l_hip and l_kne and l_ank:
        angles["left_knee"] = calculate_3d_angle(l_hip, l_kne, l_ank)
    if r_hip and r_kne and r_ank:
        angles["right_knee"] = calculate_3d_angle(r_hip, r_kne, r_ank)

    # 4. Hip Hinge Angles (Shoulder -> Hip -> Knee)
    if l_shl and l_hip and l_kne:
        angles["left_hip_hinge"] = calculate_3d_angle(l_shl, l_hip, l_kne)
    if r_shl and r_hip and r_kne:
        angles["right_hip_hinge"] = calculate_3d_angle(r_shl, r_hip, r_kne)

    # 5. Spine Neutral Alignment (Mid-Shoulder -> Mid-Hip -> Mid-Knee / Vertical)
    if l_shl and r_shl and l_hip and r_hip:
        mid_shoulder = (
            (l_shl[0] + r_shl[0]) / 2.0,
            (l_shl[1] + r_shl[1]) / 2.0,
            (l_shl[2] + r_shl[2]) / 2.0,
        )
        mid_hip = (
            (l_hip[0] + r_hip[0]) / 2.0,
            (l_hip[1] + r_hip[1]) / 2.0,
            (l_hip[2] + r_hip[2]) / 2.0,
        )
        if l_kne and r_kne:
            mid_knee = (
                (l_kne[0] + r_kne[0]) / 2.0,
                (l_kne[1] + r_kne[1]) / 2.0,
                (l_kne[2] + r_kne[2]) / 2.0,
            )
            angles["spine_angle"] = calculate_3d_angle(mid_shoulder, mid_hip, mid_knee)
        elif nose:
            angles["spine_angle"] = calculate_3d_angle(nose, mid_shoulder, mid_hip)

        # Torso inclination relative to vertical
        dx = mid_shoulder[0] - mid_hip[0]
        dy = mid_hip[1] - mid_shoulder[1]  # positive if shoulder is higher than hip
        torso_deg = math.degrees(math.atan2(abs(dx), max(0.001, dy)))
        angles["torso_inclination"] = round(torso_deg, 1)

    # 6. Knee Valgus / Inward Caving (ratio of knee width to hip width)
    if l_hip and r_hip and l_kne and r_kne:
        hip_dist = abs(r_hip[0] - l_hip[0])
        knee_dist = abs(r_kne[0] - l_kne[0])
        valgus_penalty = max(0.0, (hip_dist * 0.85) - knee_dist)
        angles["knee_valgus_delta"] = round(float(valgus_penalty * 100), 1)

    # Explicit Symmetry deltas
    elbow_sym = round(abs(angles["left_elbow"] - angles["right_elbow"]), 1)
    knee_sym = round(abs(angles["left_knee"] - angles["right_knee"]), 1)
    shoulder_sym = round(abs(angles["left_shoulder_abduction"] - angles["right_shoulder_abduction"]), 1)
    hip_sym = round(abs(angles["left_hip_hinge"] - angles["right_hip_hinge"]), 1)
    angles["elbow_symmetry_delta"] = elbow_sym
    angles["knee_symmetry_delta"] = knee_sym
    angles["shoulder_symmetry_delta"] = shoulder_sym
    angles["hip_symmetry_delta"] = hip_sym

    ex_lower = (exercise_type or "bicep_curl").lower()
    if ex_lower in ["squat", "lunge"]:
        angles["symmetry_delta"] = knee_sym
    elif ex_lower in ["lateral_raise"]:
        angles["symmetry_delta"] = shoulder_sym
    elif ex_lower in ["deadlift"]:
        angles["symmetry_delta"] = hip_sym
    else:
        angles["symmetry_delta"] = elbow_sym

    # 7. Velocity-Based Training (VBT) calculation
    vbt: Dict[str, float] = {
        "wrist_velocity_mps": 0.0,
        "bar_velocity_mps": 0.0,
        "mean_velocity_mps": 0.0,
        "peak_velocity_mps": 0.0,
        "velocity_loss_pct": 0.0,
        "fatigue_detected": 0.0,
        "trajectory_y": 0.0
    }

    # Estimate pixel-to-meter scale using torso length (standard adult torso ~0.55m)
    scale_m_per_unit = 1.65
    if l_shl and r_shl and l_hip and r_hip:
        torso_len = math.sqrt(
            ((l_shl[0] + r_shl[0]) / 2.0 - (l_hip[0] + r_hip[0]) / 2.0) ** 2 +
            ((l_shl[1] + r_shl[1]) / 2.0 - (l_hip[1] + r_hip[1]) / 2.0) ** 2
        )
        if torso_len > 0.05:
            scale_m_per_unit = 0.55 / torso_len

    # Track mid-wrist or mid-hip position based on exercise biomechanics
    curr_track_y = None
    prev_track_y = None

    if ex_lower in ["squat", "lunge", "deadlift"] and l_hip and r_hip:
        curr_track_y = (l_hip[1] + r_hip[1]) / 2.0
        vbt["trajectory_y"] = round(curr_track_y, 4)
        if prev_joints:
            prev_l = prev_pt("left_hip")
            prev_r = prev_pt("right_hip")
            if prev_l and prev_r:
                prev_track_y = (prev_l[1] + prev_r[1]) / 2.0
    elif l_wrs and r_wrs:
        curr_track_y = (l_wrs[1] + r_wrs[1]) / 2.0
        vbt["trajectory_y"] = round(curr_track_y, 4)
        if prev_joints:
            prev_l = prev_pt("left_wrist")
            prev_r = prev_pt("right_wrist")
            if prev_l and prev_r:
                prev_track_y = (prev_l[1] + prev_r[1]) / 2.0
    elif l_hip and r_hip:
        curr_track_y = (l_hip[1] + r_hip[1]) / 2.0
        vbt["trajectory_y"] = round(curr_track_y, 4)
        if prev_joints:
            prev_l = prev_pt("left_hip")
            prev_r = prev_pt("right_hip")
            if prev_l and prev_r:
                prev_track_y = (prev_l[1] + prev_r[1]) / 2.0

    if curr_track_y is not None and prev_track_y is not None and dt_sec > 0.005:
        dy_norm = -(curr_track_y - prev_track_y)
        dy_meters = dy_norm * scale_m_per_unit
        vel_mps = dy_meters / dt_sec
        vel_mps = max(-3.0, min(3.0, vel_mps))
        vbt["wrist_velocity_mps"] = round(float(vel_mps), 2)
        vbt["bar_velocity_mps"] = round(float(abs(vel_mps)), 2)

    return angles, vbt


class SingleExerciseTracker:
    """Tracks state and rep quality for an individual exercise."""
    def __init__(self, exercise_type: str = "bicep_curl"):
        self.exercise_type = exercise_type
        self.current_phase = "LOCKOUT"
        self.rep_count = 0
        self.completed_reps: List[Dict] = []

        # Current rep tracking buffers
        self.rep_start_time: float = time.time()
        self.current_min_angle: float = 180.0
        self.current_max_angle: float = 0.0
        self.current_left_min: float = 180.0
        self.current_right_min: float = 180.0
        self.symmetry_deltas_in_rep: List[float] = []
        self.spine_deviations_in_rep: List[float] = []
        self.concentric_velocities: List[float] = []

        # Isometric plank timer
        self.plank_hold_start: float = time.time()
        self.plank_accumulated_seconds: float = 0.0

        # Baseline VBT velocity of 1st rep
        self.first_rep_mean_velocity: float = 0.0

    def reset(self):
        self.current_phase = "LOCKOUT"
        self.rep_count = 0
        self.completed_reps.clear()
        self.current_min_angle = 180.0
        self.current_max_angle = 0.0
        self.current_left_min = 180.0
        self.current_right_min = 180.0
        self.symmetry_deltas_in_rep.clear()
        self.spine_deviations_in_rep.clear()
        self.concentric_velocities.clear()
        self.first_rep_mean_velocity = 0.0
        self.plank_hold_start = time.time()
        self.plank_accumulated_seconds = 0.0
        self.rep_start_time = time.time()

    def update(
        self,
        angles: Dict[str, float],
        vbt: Dict[str, float],
        weight_kg: float = 0.0,
        dt_sec: float = 0.04
    ) -> Tuple[str, Optional[Dict], float, Dict[str, Any]]:
        """
        Advances the movement state machine based on exercise-specific joint biomechanics.
        Returns: (current_phase, completed_rep_dict_if_any, live_quality_score, extra_metrics)
        """
        ex = self.exercise_type
        live_vel = vbt.get("wrist_velocity_mps", 0.0)

        # Map Primary Joint Angles
        if ex == "squat":
            primary_angle = (angles.get("left_knee", 180.0) + angles.get("right_knee", 180.0)) / 2.0
            left_angle = angles.get("left_knee", 180.0)
            right_angle = angles.get("right_knee", 180.0)
            symmetry_delta = abs(left_angle - right_angle)
        elif ex == "deadlift":
            primary_angle = (angles.get("left_hip_hinge", 180.0) + angles.get("right_hip_hinge", 180.0)) / 2.0
            left_angle = angles.get("left_hip_hinge", 180.0)
            right_angle = angles.get("right_hip_hinge", 180.0)
            symmetry_delta = abs(left_angle - right_angle)
        elif ex in ["overhead_press", "ohp"]:
            primary_angle = (angles.get("left_elbow", 180.0) + angles.get("right_elbow", 180.0)) / 2.0
            left_angle = angles.get("left_elbow", 180.0)
            right_angle = angles.get("right_elbow", 180.0)
            symmetry_delta = angles.get("symmetry_delta", 0.0)
        elif ex in ["push_up", "pushup"]:
            primary_angle = (angles.get("left_elbow", 180.0) + angles.get("right_elbow", 180.0)) / 2.0
            left_angle = angles.get("left_elbow", 180.0)
            right_angle = angles.get("right_elbow", 180.0)
            symmetry_delta = angles.get("symmetry_delta", 0.0)
        elif ex == "lateral_raise":
            # Primary: Shoulder abduction angle
            primary_angle = (angles.get("left_shoulder_abduction", 0.0) + angles.get("right_shoulder_abduction", 0.0)) / 2.0
            left_angle = angles.get("left_shoulder_abduction", 0.0)
            right_angle = angles.get("right_shoulder_abduction", 0.0)
            symmetry_delta = abs(left_angle - right_angle)
        elif ex == "lunge":
            # Primary: Lead knee depth (min of left & right)
            left_angle = angles.get("left_knee", 180.0)
            right_angle = angles.get("right_knee", 180.0)
            primary_angle = min(left_angle, right_angle)
            symmetry_delta = 0.0
        elif ex == "bent_over_row":
            primary_angle = (angles.get("left_elbow", 180.0) + angles.get("right_elbow", 180.0)) / 2.0
            left_angle = angles.get("left_elbow", 180.0)
            right_angle = angles.get("right_elbow", 180.0)
            symmetry_delta = angles.get("symmetry_delta", 0.0)
        elif ex == "plank":
            # Primary: Hip alignment angle
            primary_angle = (angles.get("left_hip_hinge", 180.0) + angles.get("right_hip_hinge", 180.0)) / 2.0
            left_angle = angles.get("left_hip_hinge", 180.0)
            right_angle = angles.get("right_hip_hinge", 180.0)
            symmetry_delta = abs(left_angle - right_angle)
        else:  # bicep_curl
            primary_angle = (angles.get("left_elbow", 180.0) + angles.get("right_elbow", 180.0)) / 2.0
            left_angle = angles.get("left_elbow", 180.0)
            right_angle = angles.get("right_elbow", 180.0)
            symmetry_delta = angles.get("symmetry_delta", 0.0)

        # Spine neutral alignment deviation from 180 deg
        spine_angle = angles.get("spine_angle", 180.0)
        spine_dev = abs(180.0 - spine_angle)
        valgus_dev = angles.get("knee_valgus_delta", 0.0)

        # Injury Risk index
        injury_risk = "LOW"
        if spine_dev > 30.0 or valgus_dev > 25.0:
            injury_risk = "HIGH"
        elif spine_dev > 18.0 or valgus_dev > 12.0:
            injury_risk = "MODERATE"

        completed_rep = None

        # -------------------------------------------------------------
        # EXERCISE-SPECIFIC FINITE STATE MACHINES
        # -------------------------------------------------------------
        if ex == "squat":
            if self.current_phase == "LOCKOUT":
                if primary_angle < 145.0:
                    self.current_phase = "ECCENTRIC"
                    self._start_new_rep(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
            elif self.current_phase == "ECCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle <= 95.0:
                    self.current_phase = "BOTTOM_PAUSE"
                elif primary_angle > self.current_min_angle + 8.0:
                    self.current_phase = "CONCENTRIC"
            elif self.current_phase == "BOTTOM_PAUSE":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle > self.current_min_angle + 8.0:
                    self.current_phase = "CONCENTRIC"
            elif self.current_phase == "CONCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if live_vel > 0.05:
                    self.concentric_velocities.append(live_vel)
                if primary_angle >= 142.0:
                    self.current_phase = "LOCKOUT"
                    completed_rep = self._finalize_rep(target_min_angle=90.0, weight_kg=weight_kg)

        elif ex == "deadlift":
            if self.current_phase == "LOCKOUT":
                if primary_angle < 148.0:
                    self.current_phase = "ECCENTRIC"
                    self._start_new_rep(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
            elif self.current_phase == "ECCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle <= 112.0:
                    self.current_phase = "BOTTOM_PAUSE"
                elif primary_angle > self.current_min_angle + 8.0:
                    self.current_phase = "CONCENTRIC"
            elif self.current_phase == "BOTTOM_PAUSE":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle > self.current_min_angle + 8.0:
                    self.current_phase = "CONCENTRIC"
            elif self.current_phase == "CONCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if live_vel > 0.05:
                    self.concentric_velocities.append(live_vel)
                if primary_angle >= 145.0:
                    self.current_phase = "LOCKOUT"
                    completed_rep = self._finalize_rep(target_min_angle=105.0, weight_kg=weight_kg)

        elif ex in ["overhead_press", "ohp"]:
            if self.current_phase == "LOCKOUT":
                if primary_angle > 85.0:
                    self.current_phase = "CONCENTRIC"
                    self._start_new_rep(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
            elif self.current_phase == "CONCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if live_vel > 0.05:
                    self.concentric_velocities.append(live_vel)
                if primary_angle >= 148.0:
                    self.current_phase = "BOTTOM_PAUSE"
                elif primary_angle < self.current_max_angle - 10.0:
                    self.current_phase = "ECCENTRIC"
            elif self.current_phase == "BOTTOM_PAUSE":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle < self.current_max_angle - 8.0:
                    self.current_phase = "ECCENTRIC"
            elif self.current_phase == "ECCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle <= 92.0:
                    self.current_phase = "LOCKOUT"
                    completed_rep = self._finalize_rep(target_min_angle=85.0, is_overhead=True, weight_kg=weight_kg)

        elif ex in ["push_up", "pushup"]:
            if self.current_phase == "LOCKOUT":
                if primary_angle < 145.0:
                    self.current_phase = "ECCENTRIC"
                    self._start_new_rep(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
            elif self.current_phase == "ECCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle <= 95.0:
                    self.current_phase = "BOTTOM_PAUSE"
                elif primary_angle > self.current_min_angle + 8.0:
                    self.current_phase = "CONCENTRIC"
            elif self.current_phase == "BOTTOM_PAUSE":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle > self.current_min_angle + 8.0:
                    self.current_phase = "CONCENTRIC"
            elif self.current_phase == "CONCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if live_vel > 0.05:
                    self.concentric_velocities.append(live_vel)
                if primary_angle >= 142.0:
                    self.current_phase = "LOCKOUT"
                    completed_rep = self._finalize_rep(target_min_angle=90.0, weight_kg=weight_kg)

        elif ex == "lateral_raise":
            if self.current_phase == "LOCKOUT":
                if primary_angle > 30.0:
                    self.current_phase = "CONCENTRIC"
                    self._start_new_rep(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
            elif self.current_phase == "CONCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if live_vel > 0.05:
                    self.concentric_velocities.append(live_vel)
                if primary_angle >= 75.0:
                    self.current_phase = "BOTTOM_PAUSE"
                elif primary_angle < self.current_max_angle - 8.0:
                    self.current_phase = "ECCENTRIC"
            elif self.current_phase == "BOTTOM_PAUSE":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle < self.current_max_angle - 8.0:
                    self.current_phase = "ECCENTRIC"
            elif self.current_phase == "ECCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle <= 36.0:
                    self.current_phase = "LOCKOUT"
                    completed_rep = self._finalize_rep(target_min_angle=80.0, is_overhead=True, weight_kg=weight_kg)

        elif ex == "lunge":
            if self.current_phase == "LOCKOUT":
                if primary_angle < 142.0:
                    self.current_phase = "ECCENTRIC"
                    self._start_new_rep(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
            elif self.current_phase == "ECCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle <= 100.0:
                    self.current_phase = "BOTTOM_PAUSE"
                elif primary_angle > self.current_min_angle + 8.0:
                    self.current_phase = "CONCENTRIC"
            elif self.current_phase == "BOTTOM_PAUSE":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle > self.current_min_angle + 8.0:
                    self.current_phase = "CONCENTRIC"
            elif self.current_phase == "CONCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle >= 138.0:
                    self.current_phase = "LOCKOUT"
                    completed_rep = self._finalize_rep(target_min_angle=95.0, weight_kg=weight_kg)

        elif ex == "bent_over_row":
            if self.current_phase == "LOCKOUT":
                if primary_angle < 135.0:
                    self.current_phase = "CONCENTRIC"
                    self._start_new_rep(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
            elif self.current_phase == "CONCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if live_vel > 0.05:
                    self.concentric_velocities.append(live_vel)
                if primary_angle <= 88.0:
                    self.current_phase = "BOTTOM_PAUSE"
                elif primary_angle > self.current_min_angle + 10.0:
                    self.current_phase = "ECCENTRIC"
            elif self.current_phase == "BOTTOM_PAUSE":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle > self.current_min_angle + 8.0:
                    self.current_phase = "ECCENTRIC"
            elif self.current_phase == "ECCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle >= 135.0:
                    self.current_phase = "LOCKOUT"
                    completed_rep = self._finalize_rep(target_min_angle=85.0, weight_kg=weight_kg)

        elif ex == "plank":
            # Isometric hold: 1 rep counted every 10 seconds of solid hold
            if primary_angle >= 155.0 and spine_dev <= 25.0:
                self.current_phase = "CONCENTRIC"  # Active hold
                self.plank_accumulated_seconds += max(0.01, min(0.2, dt_sec))
                if self.plank_accumulated_seconds >= 10.0:
                    self.plank_accumulated_seconds = 0.0
                    completed_rep = self._finalize_rep(target_min_angle=170.0, weight_kg=weight_kg)
            else:
                self.current_phase = "LOCKOUT"  # Sagging/rest

        else:
            # BICEP CURL
            if self.current_phase == "LOCKOUT":
                if primary_angle < 140.0:
                    self.current_phase = "CONCENTRIC"
                    self._start_new_rep(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
            elif self.current_phase == "CONCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if live_vel > 0.05:
                    self.concentric_velocities.append(live_vel)
                if primary_angle <= 85.0:
                    self.current_phase = "BOTTOM_PAUSE"
                elif primary_angle > self.current_min_angle + 10.0:
                    self.current_phase = "ECCENTRIC"
            elif self.current_phase == "BOTTOM_PAUSE":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle > self.current_min_angle + 8.0:
                    self.current_phase = "ECCENTRIC"
            elif self.current_phase == "ECCENTRIC":
                self._record_rep_frame(primary_angle, left_angle, right_angle, symmetry_delta, spine_dev)
                if primary_angle >= 135.0:
                    self.current_phase = "LOCKOUT"
                    completed_rep = self._finalize_rep(target_min_angle=75.0, weight_kg=weight_kg)

        # Real-time instant score
        live_score = self._compute_instant_score(primary_angle, symmetry_delta, spine_dev)
        extra_metrics = {
            "injury_risk": injury_risk,
            "max_spine_dev": max(self.spine_deviations_in_rep) if self.spine_deviations_in_rep else round(spine_dev, 1),
            "valgus_dev": valgus_dev
        }

        return self.current_phase, completed_rep, live_score, extra_metrics

    def _start_new_rep(self, primary: float, left: float, right: float, sym: float, spine_dev: float):
        self.rep_start_time = time.time()
        self.current_min_angle = primary
        self.current_max_angle = primary
        self.current_left_min = left
        self.current_right_min = right
        self.symmetry_deltas_in_rep = [sym]
        self.spine_deviations_in_rep = [spine_dev]
        self.concentric_velocities.clear()

    def _record_rep_frame(self, primary: float, left: float, right: float, sym: float, spine_dev: float):
        self.current_min_angle = min(self.current_min_angle, primary)
        self.current_max_angle = max(self.current_max_angle, primary)
        self.current_left_min = min(self.current_left_min, left)
        self.current_right_min = min(self.current_right_min, right)
        self.symmetry_deltas_in_rep.append(sym)
        self.spine_deviations_in_rep.append(spine_dev)

    def _compute_instant_score(self, primary_angle: float, symmetry_delta: float, spine_dev: float) -> float:
        sym_penalty = max(0.0, symmetry_delta - 6.0) * 1.8
        spine_penalty = max(0.0, spine_dev - 15.0) * 1.5

        if self.current_phase in ["BOTTOM_PAUSE", "CONCENTRIC", "ECCENTRIC"]:
            score = max(35.0, min(100.0, 96.0 - sym_penalty - spine_penalty))
        else:
            score = max(50.0, min(100.0, 98.0 - sym_penalty - (spine_penalty * 0.5)))

        return round(score, 1)

    def _finalize_rep(
        self,
        target_min_angle: float = 90.0,
        is_overhead: bool = False,
        weight_kg: float = 0.0
    ) -> Dict[str, Any]:
        self.rep_count += 1
        duration_ms = round((time.time() - self.rep_start_time) * 1000, 1)

        avg_symmetry = (
            sum(self.symmetry_deltas_in_rep) / len(self.symmetry_deltas_in_rep)
            if self.symmetry_deltas_in_rep else 0.0
        )
        avg_symmetry = round(avg_symmetry, 1)

        max_spine = (
            max(self.spine_deviations_in_rep)
            if self.spine_deviations_in_rep else 0.0
        )
        max_spine = round(max_spine, 1)

        # Depth score
        if is_overhead:
            if self.current_max_angle >= 155.0:
                depth_score = 100.0
                depth_note = f"Full lockout achieved ({self.current_max_angle:.1f} deg >= 155 deg)"
            else:
                depth_score = max(50.0, 100.0 - (155.0 - self.current_max_angle) * 1.5)
                depth_note = f"Partial lockout ({self.current_max_angle:.1f} deg)"
        else:
            if self.current_min_angle <= target_min_angle:
                depth_score = 100.0
                depth_note = f"Full ROM achieved ({self.current_min_angle:.1f} deg <= {target_min_angle:.1f} deg)"
            else:
                shortfall = self.current_min_angle - target_min_angle
                depth_penalty = shortfall * 1.5
                depth_score = max(20.0, 100.0 - depth_penalty)
                depth_note = f"Partial ROM ({self.current_min_angle:.1f} deg), missed depth by {shortfall:.1f} deg"

        # Symmetry score
        if avg_symmetry <= 6.0:
            sym_score = 100.0
            sym_note = f"Symmetric form (delta {avg_symmetry:.1f} deg)"
        else:
            sym_penalty = (avg_symmetry - 6.0) * 2.0
            sym_score = max(30.0, 100.0 - sym_penalty)
            sym_note = f"Asymmetry detected (delta {avg_symmetry:.1f} deg)"

        # Spine score
        if max_spine <= 18.0:
            spine_score = 100.0
        else:
            spine_penalty = (max_spine - 18.0) * 1.8
            spine_score = max(20.0, 100.0 - spine_penalty)

        final_quality = round((0.45 * depth_score) + (0.35 * sym_score) + (0.20 * spine_score), 1)

        # VBT metrics
        mean_vel = 0.0
        peak_vel = 0.0
        if self.concentric_velocities:
            mean_vel = round(float(np.mean(self.concentric_velocities)), 2)
            peak_vel = round(float(np.max(self.concentric_velocities)), 2)
        else:
            mean_vel = round(max(0.2, min(1.2, 0.65 / max(0.5, duration_ms / 1000.0))), 2)
            peak_vel = round(mean_vel * 1.35, 2)

        if self.first_rep_mean_velocity == 0.0 and mean_vel > 0:
            self.first_rep_mean_velocity = mean_vel

        vel_loss = 0.0
        if self.first_rep_mean_velocity > 0:
            loss = (1.0 - (mean_vel / self.first_rep_mean_velocity)) * 100.0
            vel_loss = round(max(0.0, loss), 1)

        fatigue_note = ""
        if vel_loss >= 20.0:
            fatigue_note = f" | High Fatigue Alert: {vel_loss:.1f}% velocity drop"

        # Sports-science 1RM & Power calculation
        sports_metrics = calculate_1rm_and_power(weight_kg, mean_vel, self.exercise_type)

        rep_data = {
            "rep_number": self.rep_count,
            "peak_depth_angle": round(self.current_min_angle, 1),
            "peak_left_elbow": round(self.current_left_min, 1),
            "peak_right_elbow": round(self.current_right_min, 1),
            "avg_symmetry_delta": avg_symmetry,
            "quality_score": final_quality,
            "duration_ms": duration_ms,
            "mean_velocity_mps": mean_vel,
            "peak_velocity_mps": peak_vel,
            "velocity_loss_pct": vel_loss,
            "max_spine_dev": max_spine,
            "power_watts": sports_metrics["power_watts"],
            "estimated_1rm_kg": sports_metrics["estimated_1rm_kg"],
            "reps_in_reserve": sports_metrics["reps_in_reserve"],
            "feedback_notes": f"{depth_note} | {sym_note}{fatigue_note}"
        }

        self.completed_reps.append(rep_data)

        # Reset current rep tracking buffers for the next rep
        self.current_min_angle = 180.0
        self.current_max_angle = 0.0
        self.current_left_min = 180.0
        self.current_right_min = 180.0
        self.symmetry_deltas_in_rep = []
        self.spine_deviations_in_rep = []
        self.concentric_velocities = []

        return rep_data


class MultiExerciseStateMachine:
    """
    Unified manager that delegates to specialized trackers for each resistance exercise:
    - Bicep Curl
    - Squat
    - Deadlift
    - Overhead Press (OHP)
    - Push-up
    - Lateral Raise
    - Lunge
    - Bent-Over Row
    - Isometric Plank
    """
    def __init__(self, exercise_type: str = "bicep_curl"):
        self.exercise_type = exercise_type
        self.is_squat = (exercise_type == "squat")
        self.machines: Dict[str, SingleExerciseTracker] = {
            "bicep_curl": SingleExerciseTracker("bicep_curl"),
            "squat": SingleExerciseTracker("squat"),
            "deadlift": SingleExerciseTracker("deadlift"),
            "overhead_press": SingleExerciseTracker("overhead_press"),
            "ohp": SingleExerciseTracker("overhead_press"),
            "push_up": SingleExerciseTracker("push_up"),
            "pushup": SingleExerciseTracker("push_up"),
            "lateral_raise": SingleExerciseTracker("lateral_raise"),
            "lunge": SingleExerciseTracker("lunge"),
            "bent_over_row": SingleExerciseTracker("bent_over_row"),
            "plank": SingleExerciseTracker("plank"),
        }

    @property
    def current_tracker(self) -> SingleExerciseTracker:
        key = self.exercise_type.lower()
        if key not in self.machines:
            self.machines[key] = SingleExerciseTracker(key)
        return self.machines[key]

    @property
    def current_phase(self) -> str:
        return self.current_tracker.current_phase

    @current_phase.setter
    def current_phase(self, val: str):
        self.current_tracker.current_phase = val

    @property
    def rep_count(self) -> int:
        return self.current_tracker.rep_count

    @property
    def completed_reps(self) -> List[Dict]:
        return self.current_tracker.completed_reps

    def reset(self, exercise_type: Optional[str] = None):
        if exercise_type:
            self.exercise_type = exercise_type
            self.is_squat = (exercise_type == "squat")
        self.current_tracker.reset()

    def update(
        self,
        angles: Dict[str, float],
        vbt: Dict[str, float],
        weight_kg: float = 0.0,
        dt_sec: float = 0.04
    ) -> Tuple[str, Optional[Dict], float, Dict[str, Any]]:
        return self.current_tracker.update(angles, vbt, weight_kg=weight_kg, dt_sec=dt_sec)


# Backwards compatibility alias
RepetitionStateMachine = MultiExerciseStateMachine
