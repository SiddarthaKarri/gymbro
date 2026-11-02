import math
from typing import Dict, List, Optional, Tuple
from app.models import Point3D


class OneEuroFilter1D:
    """
    1D One Euro Filter (Casiez et al., CHI 2012).
    Standard low-latency, adaptive filter for human motion tracking:
    - High smoothing at low velocity (eliminates tremor & jitter)
    - Low lag at high velocity (preserves rapid inflection points)
    """
    def __init__(self, min_cutoff: float = 1.0, beta: float = 0.5, d_cutoff: float = 1.0):
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff

        self.x_prev: Optional[float] = None
        self.dx_prev: float = 0.0
        self.t_prev: Optional[float] = None

    def _smoothing_factor(self, dt: float, cutoff: float) -> float:
        r = 2 * math.pi * cutoff * dt
        return r / (r + 1)

    def filter(self, x: float, t: float) -> float:
        if self.t_prev is None or self.x_prev is None:
            self.x_prev = x
            self.dx_prev = 0.0
            self.t_prev = t
            return x

        dt = t - self.t_prev
        if dt <= 0.0:
            dt = 1e-4

        # Rate of change
        dx = (x - self.x_prev) / dt
        a_d = self._smoothing_factor(dt, self.d_cutoff)
        dx_hat = a_d * dx + (1.0 - a_d) * self.dx_prev

        # Adaptive cutoff based on motion velocity
        cutoff = self.min_cutoff + self.beta * abs(dx_hat)
        a = self._smoothing_factor(dt, cutoff)
        x_hat = a * x + (1.0 - a) * self.x_prev

        # State updates
        self.x_prev = x_hat
        self.dx_prev = dx_hat
        self.t_prev = t

        return x_hat


class Point3DSmoother:
    """Filters a 3D coordinate point (x, y, z) using independent One Euro filters."""
    def __init__(self, min_cutoff: float = 1.0, beta: float = 0.5):
        self.filter_x = OneEuroFilter1D(min_cutoff=min_cutoff, beta=beta)
        self.filter_y = OneEuroFilter1D(min_cutoff=min_cutoff, beta=beta)
        self.filter_z = OneEuroFilter1D(min_cutoff=min_cutoff, beta=beta)

    def filter(self, pt: Point3D, timestamp_s: float) -> Point3D:
        smoothed_x = self.filter_x.filter(pt.x, timestamp_s)
        smoothed_y = self.filter_y.filter(pt.y, timestamp_s)
        smoothed_z = self.filter_z.filter(pt.z, timestamp_s)

        return Point3D(
            x=round(smoothed_x, 4),
            y=round(smoothed_y, 4),
            z=round(smoothed_z, 4),
            visibility=pt.visibility,
            presence=pt.presence
        )


class PoseStreamSmoother:
    """Maintains 3D temporal smoothing filters for all key kinematic joints."""
    def __init__(self):
        self.smoothers: Dict[str, Point3DSmoother] = {}

    def smooth_joints(self, joints: Dict[str, Point3D], timestamp_s: float) -> Dict[str, Point3D]:
        smoothed_dict: Dict[str, Point3D] = {}
        for name, point in joints.items():
            if point is None:
                continue
            if name not in self.smoothers:
                self.smoothers[name] = Point3DSmoother()
            smoothed_dict[name] = self.smoothers[name].filter(point, timestamp_s)

        return smoothed_dict

    def reset(self):
        self.smoothers.clear()


def check_confidence_gate(
    joints: Dict[str, Point3D],
    critical_joints: Optional[List[str]] = None,
    threshold: float = 0.65
) -> Tuple[bool, List[str], str]:
    """
    Confidence Gate (Phase 3 Objective 2):
    Checks whether any critical landmark's visibility falls below the 0.65 threshold.
    Returns: (is_valid, list_of_compromised_joints, user_feedback_message)
    """
    if critical_joints is None:
        critical_joints = ["left_elbow", "right_elbow", "left_wrist", "right_wrist", "left_shoulder", "right_shoulder"]

    compromised = []
    for joint_name in critical_joints:
        joint = joints.get(joint_name)
        if joint is None:
            compromised.append(joint_name)
            continue
        # Check visibility score if available
        if joint.visibility is not None and joint.visibility < threshold:
            compromised.append(joint_name)

    if compromised:
        readable_joints = ", ".join(j.replace("_", " ").title() for j in compromised)
        msg = f"Visibility Warning: Low tracking confidence on {readable_joints} (< {threshold})"
        return False, compromised, msg

    return True, [], "Tracking confidence verified (>= 0.65)"
