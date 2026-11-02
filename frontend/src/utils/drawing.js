/**
 * Advanced Biomechanical HUD & Exoskeleton Drawing Engine
 * Replaces standard stick model with:
 * 1. Volumetric Cyber Exoskeleton Armor (Tapered 3D limb capsules & chestplate)
 * 2. Active Muscle Tension Heatmap (Biceps/Quads glow during concentric load)
 * 3. Real-Time Directional Correction Vectors (Glowing lift arrows & cues)
 * 4. Holographic Target Form Phantom (Ideal ROM ghost alignment)
 * 5. Rotary Joint Angle Gauges (Visual target sweep zones)
 */

export const BLAZEPOSE_JOINTS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

export const KEY_RESISTANCE_JOINTS = {
  left_shoulder: { idx: 11, label: "L.SHL", side: "left" },
  right_shoulder: { idx: 12, label: "R.SHL", side: "right" },
  left_elbow: { idx: 13, label: "L.ELB", side: "left" },
  right_elbow: { idx: 14, label: "R.ELB", side: "right" },
  left_wrist: { idx: 15, label: "L.WRS", side: "left" },
  right_wrist: { idx: 16, label: "R.WRS", side: "right" },
  left_hip: { idx: 23, label: "L.HIP", side: "left" },
  right_hip: { idx: 24, label: "R.HIP", side: "right" },
  left_knee: { idx: 25, label: "L.KNE", side: "left" },
  right_knee: { idx: 26, label: "R.KNE", side: "right" },
  left_ankle: { idx: 27, label: "L.ANK", side: "left" },
  right_ankle: { idx: 28, label: "R.ANK", side: "right" },
};

export function extractKeyJoints(landmarks) {
  if (!landmarks || landmarks.length === 0) return null;
  const result = {};
  for (const [key, meta] of Object.entries(KEY_RESISTANCE_JOINTS)) {
    const lm = landmarks[meta.idx];
    if (lm) {
      result[key] = {
        x: Number(lm.x.toFixed(4)),
        y: Number(lm.y.toFixed(4)),
        z: Number((lm.z ?? 0).toFixed(4)),
        visibility: lm.visibility !== undefined ? Number(lm.visibility.toFixed(3)) : 1.0,
      };
    }
  }
  return result;
}

/**
 * Draws a volumetric, contoured capsule limb segment between two 2D points.
 * Creates an anatomical armor segment instead of a single thin stick.
 */
function drawVolumetricCapsule(ctx, p1, p2, r1, r2, colorOptions = {}) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-4) return;

  const nx = -dy / length;
  const ny = dx / length;

  // 4 corners of tapered trapezoid
  const x1_a = p1.x + nx * r1;
  const y1_a = p1.y + ny * r1;
  const x1_b = p1.x - nx * r1;
  const y1_b = p1.y - ny * r1;

  const x2_a = p2.x + nx * r2;
  const y2_a = p2.y + ny * r2;
  const x2_b = p2.x - nx * r2;
  const y2_b = p2.y - ny * r2;

  ctx.save();

  // Create capsule path
  ctx.beginPath();
  ctx.arc(p1.x, p1.y, r1, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
  ctx.lineTo(x2_a, y2_a);
  ctx.arc(p2.x, p2.y, r2, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
  ctx.lineTo(x1_b, y1_b);
  ctx.closePath();

  // Interior volumetric gradient
  const grad = ctx.createLinearGradient(x1_a, y1_a, x1_b, y1_b);
  const fillColor = colorOptions.fillColor || "rgba(0, 242, 254, 0.22)";
  const highlightColor = colorOptions.highlightColor || "rgba(0, 242, 254, 0.45)";
  const edgeColor = colorOptions.edgeColor || "#00f2fe";

  grad.addColorStop(0, highlightColor);
  grad.addColorStop(0.5, fillColor);
  grad.addColorStop(1, highlightColor);

  ctx.fillStyle = grad;
  ctx.fill();

  // Glowing cyber armor edge
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = colorOptions.borderWidth || 2.0;
  ctx.shadowColor = edgeColor;
  ctx.shadowBlur = colorOptions.glow ? 10 : 0;
  ctx.stroke();

  // Central biometric armor seam line
  ctx.beginPath();
  ctx.moveTo(p1.x + (dx * 0.15), p1.y + (dy * 0.15));
  ctx.lineTo(p2.x - (dx * 0.15), p2.y - (dy * 0.15));
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws the complete futuristic Biomechanical Cyber-Exoskeleton
 */
export function drawKinematicExoskeleton(ctx, landmarks, width, height, options = {}) {
  if (!landmarks || landmarks.length < 33) return;

  const {
    repPhase = "LOCKOUT",
    angles = null,
    compromisedJoints = [],
    showAngles = true,
    exerciseType = "bicep_curl",
  } = options;

  const compSet = new Set(compromisedJoints);

  // Helper to convert normalized coordinate to screen pixels
  const pt = (idx) => {
    const lm = landmarks[idx];
    return lm ? { x: lm.x * width, y: lm.y * height, v: lm.visibility ?? 1.0 } : null;
  };

  const lShl = pt(BLAZEPOSE_JOINTS.LEFT_SHOULDER);
  const rShl = pt(BLAZEPOSE_JOINTS.RIGHT_SHOULDER);
  const lElb = pt(BLAZEPOSE_JOINTS.LEFT_ELBOW);
  const rElb = pt(BLAZEPOSE_JOINTS.RIGHT_ELBOW);
  const lWrs = pt(BLAZEPOSE_JOINTS.LEFT_WRIST);
  const rWrs = pt(BLAZEPOSE_JOINTS.RIGHT_WRIST);
  const lHip = pt(BLAZEPOSE_JOINTS.LEFT_HIP);
  const rHip = pt(BLAZEPOSE_JOINTS.RIGHT_HIP);
  const lKne = pt(BLAZEPOSE_JOINTS.LEFT_KNEE);
  const rKne = pt(BLAZEPOSE_JOINTS.RIGHT_KNEE);
  const lAnk = pt(BLAZEPOSE_JOINTS.LEFT_ANKLE);
  const rAnk = pt(BLAZEPOSE_JOINTS.RIGHT_ANKLE);

  const isUnderConcentricTension = repPhase === "CONCENTRIC" || repPhase === "BOTTOM_PAUSE";

  // -------------------------------------------------------------
  // 1. TORSO CHESTPLATE ARMOR (Hexagonal Biomechanical Plate)
  // -------------------------------------------------------------
  if (lShl && rShl && lHip && rHip) {
    ctx.save();
    ctx.beginPath();
    const neckX = (lShl.x + rShl.x) / 2;
    const neckY = (lShl.y + rShl.y) / 2 - 16;
    const groinX = (lHip.x + rHip.x) / 2;
    const groinY = (lHip.y + rHip.y) / 2 + 16;

    ctx.moveTo(lShl.x, lShl.y);
    ctx.lineTo(neckX, neckY);
    ctx.lineTo(rShl.x, rShl.y);
    ctx.lineTo(rHip.x, rHip.y);
    ctx.lineTo(groinX, groinY);
    ctx.lineTo(lHip.x, lHip.y);
    ctx.closePath();

    const torsoGrad = ctx.createLinearGradient(lShl.x, lShl.y, rHip.x, rHip.y);
    torsoGrad.addColorStop(0, "rgba(168, 85, 247, 0.25)");
    torsoGrad.addColorStop(0.5, "rgba(56, 189, 248, 0.18)");
    torsoGrad.addColorStop(1, "rgba(16, 185, 129, 0.22)");

    ctx.fillStyle = torsoGrad;
    ctx.fill();
    ctx.strokeStyle = "rgba(168, 85, 247, 0.7)";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#a855f7";
    ctx.shadowBlur = 12;
    ctx.stroke();

    // Central Biomechanical Arc Reactor Core (Sternum Center)
    const coreX = (lShl.x + rShl.x + lHip.x + rHip.x) / 4;
    const coreY = (lShl.y + rShl.y + lHip.y + rHip.y) / 4 - 8;
    const corePulse = (Math.sin(performance.now() * 0.005) + 1) / 2;

    ctx.beginPath();
    ctx.arc(coreX, coreY, 14 + corePulse * 4, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0, 242, 254, 0.2)";
    ctx.fill();
    ctx.strokeStyle = "#00f2fe";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(coreX, coreY, 5, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#00f2fe";
    ctx.fill();

    ctx.restore();
  }

  // -------------------------------------------------------------
  // 2. VOLUMETRIC ARMS (BICEPS / FOREARMS)
  // -------------------------------------------------------------
  // Muscle activation styling when flexing under tension
  const bicepFill = isUnderConcentricTension
    ? "rgba(245, 158, 11, 0.4)" // Amber heat under tension
    : "rgba(56, 189, 248, 0.25)";
  const bicepEdge = isUnderConcentricTension ? "#f59e0b" : "#38bdf8";

  // Left Upper Arm (Bicep/Tricep Hull)
  if (lShl && lElb) {
    const isComp = compSet.has("left_shoulder") || compSet.has("left_elbow");
    drawVolumetricCapsule(ctx, lShl, lElb, 16, 13, {
      fillColor: isComp ? "rgba(239, 68, 68, 0.35)" : bicepFill,
      edgeColor: isComp ? "#ef4444" : bicepEdge,
      glow: true,
    });
  }

  // Right Upper Arm
  if (rShl && rElb) {
    const isComp = compSet.has("right_shoulder") || compSet.has("right_elbow");
    drawVolumetricCapsule(ctx, rShl, rElb, 16, 13, {
      fillColor: isComp ? "rgba(239, 68, 68, 0.35)" : bicepFill,
      edgeColor: isComp ? "#ef4444" : bicepEdge,
      glow: true,
    });
  }

  // Left Forearm
  if (lElb && lWrs) {
    const isComp = compSet.has("left_elbow") || compSet.has("left_wrist");
    drawVolumetricCapsule(ctx, lElb, lWrs, 13, 10, {
      fillColor: isComp ? "rgba(239, 68, 68, 0.35)" : "rgba(0, 242, 254, 0.25)",
      edgeColor: isComp ? "#ef4444" : "#00f2fe",
      glow: true,
    });
  }

  // Right Forearm
  if (rElb && rWrs) {
    const isComp = compSet.has("right_elbow") || compSet.has("right_wrist");
    drawVolumetricCapsule(ctx, rElb, rWrs, 13, 10, {
      fillColor: isComp ? "rgba(239, 68, 68, 0.35)" : "rgba(52, 211, 153, 0.25)",
      edgeColor: isComp ? "#ef4444" : "#34d399",
      glow: true,
    });
  }

  // -------------------------------------------------------------
  // 3. VOLUMETRIC LEGS (QUADS & CALVES)
  // -------------------------------------------------------------
  if (lHip && lKne) {
    drawVolumetricCapsule(ctx, lHip, lKne, 18, 14, {
      fillColor: "rgba(56, 189, 248, 0.2)",
      edgeColor: "#38bdf8",
      glow: false,
    });
  }
  if (rHip && rKne) {
    drawVolumetricCapsule(ctx, rHip, rKne, 18, 14, {
      fillColor: "rgba(52, 211, 153, 0.2)",
      edgeColor: "#34d399",
      glow: false,
    });
  }
  if (lKne && lAnk) {
    drawVolumetricCapsule(ctx, lKne, lAnk, 14, 11, {
      fillColor: "rgba(56, 189, 248, 0.18)",
      edgeColor: "#38bdf8",
      glow: false,
    });
  }
  if (rKne && rAnk) {
    drawVolumetricCapsule(ctx, rKne, rAnk, 14, 11, {
      fillColor: "rgba(52, 211, 153, 0.18)",
      edgeColor: "#34d399",
      glow: false,
    });
  }

  // -------------------------------------------------------------
  // 4. ROTARY JOINT NODES & ROTARY ANGLE GAUGES
  // -------------------------------------------------------------
  for (const [name, meta] of Object.entries(KEY_RESISTANCE_JOINTS)) {
    const p = pt(meta.idx);
    if (!p || p.v < 0.25) continue;

    const isLeft = meta.side === "left";
    const isComp = compSet.has(name);
    const primaryColor = isComp ? "#ef4444" : isLeft ? "#38bdf8" : "#34d399";

    ctx.save();

    // High-tech rotary bearing ring
    ctx.beginPath();
    ctx.arc(p.x, p.y, isComp ? 13 : 9, 0, 2 * Math.PI);
    ctx.fillStyle = isComp ? "rgba(239, 68, 68, 0.3)" : "rgba(10, 16, 30, 0.8)";
    ctx.fill();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = isComp ? 2.5 : 1.5;
    ctx.stroke();

    // Solid core pivot
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // Joint Label Tag
    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillStyle = isComp ? "#ef4444" : "#ffffff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 4;
    const textOffset = isLeft ? -22 : 14;
    ctx.fillText(meta.label, p.x + textOffset, p.y - 7);

    ctx.restore();
  }

  // -------------------------------------------------------------
  // 5. ROTARY ANGLE ARCS (Dynamic per Exercise Movement)
  // -------------------------------------------------------------
  if (showAngles && angles) {
    const ex = (exerciseType || "bicep_curl").toLowerCase();
    if (ex === "squat" || ex === "lunge") {
      // Lower body knee depth gauges (Knee flexion <= 95°)
      if (lKne && angles.left_knee != null) {
        drawRotaryAngleGauge(ctx, lKne, lHip, lAnk, angles.left_knee, 95, "#38bdf8", "less_than", "Knee");
      }
      if (rKne && angles.right_knee != null) {
        drawRotaryAngleGauge(ctx, rKne, rHip, rAnk, angles.right_knee, 95, "#34d399", "less_than", "Knee");
      }
    } else if (ex === "deadlift") {
      // Hip hinge gauges (Hip hinge <= 112°)
      if (lHip && angles.left_hip_hinge != null) {
        drawRotaryAngleGauge(ctx, lHip, lShl, lKne, angles.left_hip_hinge, 112, "#38bdf8", "less_than", "Hinge");
      }
      if (rHip && angles.right_hip_hinge != null) {
        drawRotaryAngleGauge(ctx, rHip, rShl, rKne, angles.right_hip_hinge, 112, "#34d399", "less_than", "Hinge");
      }
    } else if (ex === "lateral_raise") {
      // Shoulder abduction gauges (Shoulder abduction >= 75°)
      if (lShl && angles.left_shoulder_abduction != null) {
        drawRotaryAngleGauge(ctx, lShl, lHip, lElb, angles.left_shoulder_abduction, 75, "#38bdf8", "greater_than", "Abduct");
      }
      if (rShl && angles.right_shoulder_abduction != null) {
        drawRotaryAngleGauge(ctx, rShl, rHip, rElb, angles.right_shoulder_abduction, 75, "#34d399", "greater_than", "Abduct");
      }
    } else if (ex === "overhead_press" || ex === "ohp") {
      // Overhead press elbow lockout gauges (Lockout >= 148°)
      if (lElb && angles.left_elbow != null) {
        drawRotaryAngleGauge(ctx, lElb, lShl, lWrs, angles.left_elbow, 148, "#38bdf8", "greater_than", "Lockout");
      }
      if (rElb && angles.right_elbow != null) {
        drawRotaryAngleGauge(ctx, rElb, rShl, rWrs, angles.right_elbow, 148, "#34d399", "greater_than", "Lockout");
      }
    } else if (ex === "plank") {
      // Core spine & hip alignment gauges (160° - 185°)
      if (lHip && angles.left_hip_hinge != null) {
        drawRotaryAngleGauge(ctx, lHip, lShl, lKne, angles.left_hip_hinge, 165, "#38bdf8", "range", "Plank");
      }
    } else if (ex === "push_up" || ex === "pushup") {
      // Push-up chest depth gauges (Elbow flexion <= 95°)
      if (lElb && angles.left_elbow != null) {
        drawRotaryAngleGauge(ctx, lElb, lShl, lWrs, angles.left_elbow, 95, "#38bdf8", "less_than", "Depth");
      }
      if (rElb && angles.right_elbow != null) {
        drawRotaryAngleGauge(ctx, rElb, rShl, rWrs, angles.right_elbow, 95, "#34d399", "less_than", "Depth");
      }
    } else if (ex === "bent_over_row") {
      // Row elbow pull retraction gauges (Elbow pull <= 88°)
      if (lElb && angles.left_elbow != null) {
        drawRotaryAngleGauge(ctx, lElb, lShl, lWrs, angles.left_elbow, 88, "#38bdf8", "less_than", "Pull");
      }
      if (rElb && angles.right_elbow != null) {
        drawRotaryAngleGauge(ctx, rElb, rShl, rWrs, angles.right_elbow, 88, "#34d399", "less_than", "Pull");
      }
    } else {
      // Default / Bicep curl (Flexion <= 75°)
      if (lElb && angles.left_elbow != null) {
        drawRotaryAngleGauge(ctx, lElb, lShl, lWrs, angles.left_elbow, 75, "#38bdf8", "less_than", "Flexion");
      }
      if (rElb && angles.right_elbow != null) {
        drawRotaryAngleGauge(ctx, rElb, rShl, rWrs, angles.right_elbow, 75, "#34d399", "less_than", "Flexion");
      }
    }
  }
}

/**
 * Draws a circular HUD gauge around a joint showing current angle vs target zone
 */
function drawRotaryAngleGauge(ctx, pivot, p1, p2, angleDeg, targetDeg = 90, accentColor = "#00f2fe", targetMode = "less_than", label = "") {
  if (!pivot || angleDeg === undefined || angleDeg === null) return;

  const radius = 32;
  let isDepthOptimal = false;
  if (targetMode === "greater_than") {
    isDepthOptimal = angleDeg >= targetDeg;
  } else if (targetMode === "range") {
    isDepthOptimal = angleDeg >= 160 && angleDeg <= 185;
  } else {
    isDepthOptimal = angleDeg <= targetDeg;
  }
  const arcColor = isDepthOptimal ? "#10b981" : "#f59e0b";

  ctx.save();

  // Angle text callout
  ctx.font = "bold 11px 'JetBrains Mono', monospace";
  ctx.fillStyle = arcColor;
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 4;
  const textStr = label ? `${Math.round(angleDeg)}° [${label}]` : `${Math.round(angleDeg)}°`;
  ctx.fillText(textStr, pivot.x - 18, pivot.y + radius + 14);

  // Target Arc Ring (Target Zone)
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Active sweep segment
  const sweepRad = Math.min(Math.PI * 2, Math.max(0, (angleDeg / 180) * Math.PI));
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, radius, -Math.PI / 2, -Math.PI / 2 + sweepRad);
  ctx.strokeStyle = arcColor;
  ctx.lineWidth = 3.5;
  ctx.shadowColor = arcColor;
  ctx.shadowBlur = 8;
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws animated glowing directional correction arrows pointing in the direction of form correction
 */
export function drawDirectionalCues(ctx, corrections = []) {
  if (!corrections || corrections.length === 0) return;

  ctx.save();
  const time = performance.now();
  const bob = Math.sin(time * 0.008) * 8;

  for (const corr of corrections) {
    const { x, y, cue, color = "#00f2fe" } = corr;
    const arrowY = y - 26 + bob;

    // Glowing Pill Banner
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    const textWidth = ctx.measureText(cue).width;
    const pad = 8;

    ctx.fillStyle = "rgba(10, 16, 28, 0.92)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.roundRect(x - (textWidth / 2) - pad, arrowY - 14, textWidth + (pad * 2), 22, 6);
    ctx.fill();
    ctx.stroke();

    // Cue Text
    ctx.fillStyle = color;
    ctx.shadowBlur = 0;
    ctx.fillText(cue, x - (textWidth / 2), arrowY + 2);

    // Dynamic Chevron Arrow
    ctx.beginPath();
    ctx.moveTo(x, arrowY + 9);
    ctx.lineTo(x - 5, arrowY + 16);
    ctx.lineTo(x + 5, arrowY + 16);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws a Holographic Target Phantom (Ghost Silhouette) showing ideal ROM targets
 */
export function drawTargetFormGhost(ctx, landmarks, width, height, exerciseType = "bicep_curl") {
  if (!landmarks || landmarks.length < 33) return;

  const lShl = landmarks[BLAZEPOSE_JOINTS.LEFT_SHOULDER];
  const rShl = landmarks[BLAZEPOSE_JOINTS.RIGHT_SHOULDER];
  const lElb = landmarks[BLAZEPOSE_JOINTS.LEFT_ELBOW];
  const rElb = landmarks[BLAZEPOSE_JOINTS.RIGHT_ELBOW];
  const lHip = landmarks[BLAZEPOSE_JOINTS.LEFT_HIP];
  const rHip = landmarks[BLAZEPOSE_JOINTS.RIGHT_HIP];
  const lKne = landmarks[BLAZEPOSE_JOINTS.LEFT_KNEE];
  const rKne = landmarks[BLAZEPOSE_JOINTS.RIGHT_KNEE];

  ctx.save();
  ctx.strokeStyle = "rgba(16, 185, 129, 0.5)"; // Emerald Ghost
  ctx.setLineDash([5, 5]);
  ctx.lineWidth = 3;

  const ex = (exerciseType || "bicep_curl").toLowerCase();

  if (ex === "bicep_curl" && lElb && rElb) {
    // Ideal 75° flexed forearm target line
    const lWristTargetX = (lElb.x + 0.04) * width;
    const lWristTargetY = (lElb.y - 0.12) * height;
    const rWristTargetX = (rElb.x - 0.04) * width;
    const rWristTargetY = (rElb.y - 0.12) * height;

    // Draw Left Ghost Forearm
    ctx.beginPath();
    ctx.moveTo(lElb.x * width, lElb.y * height);
    ctx.lineTo(lWristTargetX, lWristTargetY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(lWristTargetX, lWristTargetY, 9, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
    ctx.fill();
    ctx.stroke();

    // Draw Right Ghost Forearm
    ctx.beginPath();
    ctx.moveTo(rElb.x * width, rElb.y * height);
    ctx.lineTo(rWristTargetX, rWristTargetY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(rWristTargetX, rWristTargetY, 9, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
    ctx.fill();
    ctx.stroke();

    // Ghost label
    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#34d399";
    ctx.setLineDash([]);
    ctx.fillText("TARGET ≤ 75° FLEXION", lWristTargetX - 44, lWristTargetY - 14);
  } else if ((ex === "squat" || ex === "lunge") && lKne && rKne && lHip && rHip) {
    // Parallel femur target depth plane
    const kneeY = Math.max(lKne.y, rKne.y) * height;
    const leftX = Math.min(lHip.x, lKne.x) * width - 40;
    const rightX = Math.max(rHip.x, rKne.x) * width + 40;

    ctx.beginPath();
    ctx.moveTo(leftX, kneeY);
    ctx.lineTo(rightX, kneeY);
    ctx.stroke();

    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#34d399";
    ctx.setLineDash([]);
    ctx.fillText("PARALLEL DEPTH TARGET (≤ 95° KNEE)", leftX, kneeY - 8);
  } else if ((ex === "overhead_press" || ex === "ohp") && lShl && rShl) {
    // Overhead lockout vertical lines straight up from shoulders
    const lLockX = lShl.x * width;
    const lLockY = (lShl.y - 0.24) * height;
    const rLockX = rShl.x * width;
    const rLockY = (rShl.y - 0.24) * height;

    ctx.beginPath();
    ctx.moveTo(lShl.x * width, lShl.y * height);
    ctx.lineTo(lLockX, lLockY);
    ctx.moveTo(rShl.x * width, rShl.y * height);
    ctx.lineTo(rLockX, rLockY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(lLockX, lLockY, 9, 0, 2 * Math.PI);
    ctx.arc(rLockX, rLockY, 9, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#34d399";
    ctx.setLineDash([]);
    ctx.fillText("TARGET ≥ 148° LOCKOUT", lLockX - 40, lLockY - 14);
  } else if (ex === "lateral_raise" && lShl && rShl) {
    // Horizontal abduction phantom
    const lAbductX = (lShl.x + 0.18) * width;
    const lAbductY = lShl.y * height;
    const rAbductX = (rShl.x - 0.18) * width;
    const rAbductY = rShl.y * height;

    ctx.beginPath();
    ctx.moveTo(lShl.x * width, lShl.y * height);
    ctx.lineTo(lAbductX, lAbductY);
    ctx.moveTo(rShl.x * width, rShl.y * height);
    ctx.lineTo(rAbductX, rAbductY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(lAbductX, lAbductY, 9, 0, 2 * Math.PI);
    ctx.arc(rAbductX, rAbductY, 9, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#34d399";
    ctx.setLineDash([]);
    ctx.fillText("TARGET ≥ 75° ABDUCTION", lAbductX - 20, lAbductY - 12);
  } else if ((ex === "push_up" || ex === "pushup") && lShl && rShl) {
    // 95° elbow depth target plane
    const depthY = Math.max(lShl.y, rShl.y) * height + 28;
    const leftX = lShl.x * width - 30;
    const rightX = rShl.x * width + 30;

    ctx.beginPath();
    ctx.moveTo(leftX, depthY);
    ctx.lineTo(rightX, depthY);
    ctx.stroke();

    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#34d399";
    ctx.setLineDash([]);
    ctx.fillText("CHEST-TO-FLOOR DEPTH TARGET (≤ 95°)", leftX, depthY - 8);
  }

  ctx.restore();
}

/**
 * Draws the Glowing Barbell / Wrist Trajectory Motion Ribbon (VBT Bar Path)
 */
export function drawBarPathTrajectory(ctx, trajectoryPoints = []) {
  if (!trajectoryPoints || trajectoryPoints.length < 2) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(trajectoryPoints[0].x, trajectoryPoints[0].y);

  for (let i = 1; i < trajectoryPoints.length; i++) {
    ctx.lineTo(trajectoryPoints[i].x, trajectoryPoints[i].y);
  }

  // Glowing cyan-to-magenta trail
  ctx.strokeStyle = "rgba(0, 242, 254, 0.85)";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "#00f2fe";
  ctx.shadowBlur = 10;
  ctx.stroke();

  // Draw motion dots on recent points
  for (let i = 0; i < trajectoryPoints.length; i += 3) {
    const p = trajectoryPoints[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, 2 * Math.PI);
    ctx.fillStyle = i === trajectoryPoints.length - 1 ? "#ffffff" : "rgba(168, 85, 247, 0.9)";
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Backwards compatibility export
 */
export function drawKinematicWireframe(ctx, landmarks, width, height, options = {}) {
  return drawKinematicExoskeleton(ctx, landmarks, width, height, options);
}
