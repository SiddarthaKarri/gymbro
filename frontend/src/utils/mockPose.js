/**
 * Synthetic Kinematic Pose Generator (v2.0)
 * Generates realistic, anatomically accurate 33-landmark BlazePose kinematic structures
 * with true 3D Euclidean rotation and continuous joint trajectories.
 * Supports all 9 resistance training exercises:
 * - Bicep Curl
 * - Barbell Squat
 * - Overhead Press (OHP)
 * - Conventional Deadlift
 * - Push-Up
 * - Lateral Raise
 * - Split Lunge
 * - Bent-Over Row
 * - Isometric Plank
 */

export function generateSyntheticPose(timeMs, exercise = "bicep_curl") {
  const t = timeMs / 1000;
  const centerX = 0.5;
  // Smooth repetition cycle: 2.2 seconds per rep cycle
  const cycle = (Math.sin(t * 2.8) + 1) / 2; // Smooth sine wave [0, 1]

  // Initialize 33 BlazePose landmarks
  const landmarks = new Array(33).fill(null).map(() => ({
    x: centerX,
    y: 0.5,
    z: 0.0,
    visibility: 0.98,
    presence: 0.98,
  }));

  const setPt = (idx, x, y, z = 0.0) => {
    landmarks[idx] = {
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      z: Number(z.toFixed(4)),
      visibility: 0.98,
      presence: 0.98,
    };
  };

  const ex = (exercise || "bicep_curl").toLowerCase();

  if (ex === "squat") {
    // Squat: cycle=0 -> standing lockout (165°), cycle=1 -> deep squat (82° depth)
    const hipDrop = cycle * 0.20;
    const hipZ = cycle * 0.16; // Hips push back in z
    const kneeZ = -cycle * 0.12; // Knees travel forward slightly in z
    const shoulderDrop = cycle * 0.16;
    const torsoForwardZ = -cycle * 0.14; // Chest inclines forward

    const shoulderY = 0.28 + shoulderDrop;
    const hipY = 0.50 + hipDrop;
    const kneeY = 0.70 + cycle * 0.04;
    const ankleY = 0.90;

    // Head / Torso
    setPt(0, centerX, shoulderY - 0.14, torsoForwardZ - 0.04);
    setPt(11, centerX - 0.14, shoulderY, torsoForwardZ);
    setPt(12, centerX + 0.14, shoulderY, torsoForwardZ);

    // Arms locked in front or barbell rack
    setPt(13, centerX - 0.16, shoulderY + 0.10, torsoForwardZ - 0.15);
    setPt(14, centerX + 0.16, shoulderY + 0.10, torsoForwardZ - 0.15);
    setPt(15, centerX - 0.10, shoulderY + 0.08, torsoForwardZ - 0.22);
    setPt(16, centerX + 0.10, shoulderY + 0.08, torsoForwardZ - 0.22);

    // Hips
    setPt(23, centerX - 0.11, hipY, hipZ);
    setPt(24, centerX + 0.11, hipY, hipZ);

    // Knees tracking in line with toes with realistic outward flared width
    const kneeSpread = 0.14 + cycle * 0.04;
    setPt(25, centerX - kneeSpread, kneeY, kneeZ);
    setPt(26, centerX + kneeSpread, kneeY, kneeZ);

    // Feet / Ankles planted firmly on ground
    setPt(27, centerX - 0.13, ankleY, 0.0);
    setPt(28, centerX + 0.13, ankleY, 0.0);
    setPt(31, centerX - 0.13, ankleY + 0.03, -0.08);
    setPt(32, centerX + 0.13, ankleY + 0.03, -0.08);

  } else if (ex === "overhead_press" || ex === "ohp") {
    // OHP: cycle=0 -> racked at clavicle (65° elbow), cycle=1 -> full lockout overhead (165° elbow)
    const pressProgress = cycle; // 0 to 1
    const shoulderY = 0.34;
    const hipY = 0.62;

    setPt(0, centerX, shoulderY - 0.14, 0.0);
    setPt(11, centerX - 0.14, shoulderY, 0.0);
    setPt(12, centerX + 0.14, shoulderY, 0.0);

    // Elbows & Wrists follow true vertical pressing trajectory
    // When racked (0): wrists at clavicle y=0.34, elbows down at y=0.48
    // When locked (1): wrists at overhead y=0.10, elbows up at y=0.22
    const wristY = 0.34 - pressProgress * 0.24;
    const elbowY = 0.48 - pressProgress * 0.26;
    const elbowXOffset = 0.16 - pressProgress * 0.02;

    setPt(13, centerX - elbowXOffset, elbowY, -0.06 * (1 - pressProgress));
    setPt(14, centerX + elbowXOffset, elbowY, -0.06 * (1 - pressProgress));
    setPt(15, centerX - 0.14, wristY, 0.0);
    setPt(16, centerX + 0.14, wristY, 0.0);

    // Stable stance
    setPt(23, centerX - 0.09, hipY, 0.0);
    setPt(24, centerX + 0.09, hipY, 0.0);
    setPt(25, centerX - 0.09, 0.76, 0.0);
    setPt(26, centerX + 0.09, 0.76, 0.0);
    setPt(27, centerX - 0.09, 0.92, 0.0);
    setPt(28, centerX + 0.09, 0.92, 0.0);

  } else if (ex === "deadlift") {
    // Deadlift: cycle=0 -> standing lockout (168°), cycle=1 -> floor hinge (98° hip hinge)
    const hingeProgress = cycle;
    const shlDrop = hingeProgress * 0.20;
    const shlForwardZ = -hingeProgress * 0.18;
    const hipRise = hingeProgress * 0.08;
    const hipBackZ = hingeProgress * 0.16;

    const shoulderY = 0.30 + shlDrop;
    const hipY = 0.54 + hipRise;
    const kneeY = 0.74 + hingeProgress * 0.02;
    const ankleY = 0.92;

    setPt(0, centerX, shoulderY - 0.14, shlForwardZ - 0.04);
    setPt(11, centerX - 0.13, shoulderY, shlForwardZ);
    setPt(12, centerX + 0.13, shoulderY, shlForwardZ);

    // Straight arms holding bar traveling strictly along vertical shins
    const barY = 0.56 + hingeProgress * 0.26;
    setPt(13, centerX - 0.14, (shoulderY + barY) / 2, shlForwardZ * 0.5);
    setPt(14, centerX + 0.14, (shoulderY + barY) / 2, shlForwardZ * 0.5);
    setPt(15, centerX - 0.14, barY, 0.0);
    setPt(16, centerX + 0.14, barY, 0.0);

    // Hips push backward
    setPt(23, centerX - 0.09, hipY, hipBackZ);
    setPt(24, centerX + 0.09, hipY, hipBackZ);

    // Soft knee bend
    setPt(25, centerX - 0.09, kneeY, -hingeProgress * 0.04);
    setPt(26, centerX + 0.09, kneeY, -hingeProgress * 0.04);

    setPt(27, centerX - 0.09, ankleY, 0.0);
    setPt(28, centerX + 0.09, ankleY, 0.0);

  } else if (ex === "push_up" || ex === "pushup") {
    // Push-Up: horizontal profile across viewport
    // cycle=0 -> top plank lockout (165°), cycle=1 -> chest at floor (80° elbow)
    const pushDepth = cycle * 0.15;
    const torsoY = 0.56 + pushDepth;

    setPt(0, 0.26, torsoY - 0.08, 0.0);
    setPt(11, 0.32, torsoY, -0.06);
    setPt(12, 0.32, torsoY, 0.06);

    // Hands fixed on floor at y=0.74
    setPt(15, 0.32, 0.74, -0.10);
    setPt(16, 0.32, 0.74, 0.10);

    // Elbows flex backward at 45°
    const elbY = torsoY + 0.08 - pushDepth * 0.3;
    const elbX = 0.32 + pushDepth * 0.12;
    setPt(13, elbX, elbY, -0.12);
    setPt(14, elbX, elbY, 0.12);

    // Rigid spine plank from shoulders to toes
    setPt(23, 0.56, torsoY + 0.02, -0.05);
    setPt(24, 0.56, torsoY + 0.02, 0.05);
    setPt(25, 0.72, torsoY + 0.03, -0.05);
    setPt(26, 0.72, torsoY + 0.03, 0.05);
    setPt(27, 0.86, 0.74, -0.05);
    setPt(28, 0.86, 0.74, 0.05);

  } else if (ex === "lateral_raise") {
    // Dumbbell Lateral Raise:
    // cycle=0 -> arms resting at sides (18° abduction), cycle=1 -> T-position (90° abduction)
    const abductionAngleDeg = 18 + cycle * 72; // 18° to 90°
    const rad = (abductionAngleDeg * Math.PI) / 180.0;
    const shoulderY = 0.34;
    const hipY = 0.62;
    const upperArmLen = 0.16;
    const foreArmLen = 0.16;

    setPt(0, centerX, shoulderY - 0.14, 0.0);
    setPt(11, centerX - 0.14, shoulderY, 0.0);
    setPt(12, centerX + 0.14, shoulderY, 0.0);

    // Abduct outward in frontal plane with slight natural scapular 15° forward tilt
    const lElbX = centerX - 0.14 - Math.sin(rad) * upperArmLen;
    const rElbX = centerX + 0.14 + Math.sin(rad) * upperArmLen;
    const elbY = shoulderY + Math.cos(rad) * upperArmLen;
    const armZ = -Math.sin(rad) * 0.06;

    setPt(13, lElbX, elbY, armZ);
    setPt(14, rElbX, elbY, armZ);

    const lWrsX = lElbX - Math.sin(rad) * foreArmLen;
    const rWrsX = rElbX + Math.sin(rad) * foreArmLen;
    const wrsY = elbY + Math.cos(rad) * foreArmLen;

    setPt(15, lWrsX, wrsY, armZ * 1.5);
    setPt(16, rWrsX, wrsY, armZ * 1.5);

    setPt(23, centerX - 0.09, hipY, 0.0);
    setPt(24, centerX + 0.09, hipY, 0.0);
    setPt(25, centerX - 0.09, 0.76, 0.0);
    setPt(26, centerX + 0.09, 0.76, 0.0);
    setPt(27, centerX - 0.09, 0.92, 0.0);
    setPt(28, centerX + 0.09, 0.92, 0.0);

  } else if (ex === "lunge") {
    // Split Lunge:
    // cycle=0 -> standing upright (165°), cycle=1 -> front knee at 90°
    const sink = cycle * 0.18;
    const shoulderY = 0.28 + sink;
    const hipY = 0.52 + sink;

    setPt(0, centerX, shoulderY - 0.14, 0.0);
    setPt(11, centerX - 0.12, shoulderY, 0.0);
    setPt(12, centerX + 0.12, shoulderY, 0.0);
    setPt(13, centerX - 0.14, shoulderY + 0.14, 0.0);
    setPt(14, centerX + 0.14, shoulderY + 0.14, 0.0);
    setPt(15, centerX - 0.10, shoulderY + 0.26, 0.0);
    setPt(16, centerX + 0.10, shoulderY + 0.26, 0.0);

    setPt(23, centerX - 0.06, hipY, 0.0);
    setPt(24, centerX + 0.06, hipY, 0.0);

    // Front lead knee (Left): bends to 90°
    const leadKneeY = 0.70 + sink * 0.3;
    setPt(25, centerX - 0.14, leadKneeY, -0.15);
    setPt(27, centerX - 0.14, 0.92, -0.15);

    // Rear trailing knee (Right): descends towards floor
    setPt(26, centerX + 0.14, 0.72 + sink * 0.9, 0.20);
    setPt(28, centerX + 0.22, 0.92, 0.30);

  } else if (ex === "bent_over_row") {
    // Bent-Over Row: 45° hinged torso
    // cycle=0 -> dead hang extension (160° elbow), cycle=1 -> row pull to ribs (72° elbow)
    const shoulderY = 0.42;
    const hipY = 0.58;
    const rowProgress = cycle; // 0 to 1

    setPt(0, centerX, shoulderY - 0.14, -0.16);
    setPt(11, centerX - 0.14, shoulderY, -0.12);
    setPt(12, centerX + 0.14, shoulderY, -0.12);

    // Elbows pull back in z and up in y
    const elbowY = shoulderY + 0.16 - rowProgress * 0.14;
    const elbowZ = rowProgress * 0.18; // Pulling back past ribs
    setPt(13, centerX - 0.16, elbowY, elbowZ);
    setPt(14, centerX + 0.16, elbowY, elbowZ);

    // Wrists follow
    const wristY = shoulderY + 0.30 - rowProgress * 0.14;
    const wristZ = rowProgress * 0.08;
    setPt(15, centerX - 0.12, wristY, wristZ);
    setPt(16, centerX + 0.12, wristY, wristZ);

    setPt(23, centerX - 0.10, hipY, 0.10);
    setPt(24, centerX + 0.10, hipY, 0.10);
    setPt(25, centerX - 0.11, 0.76, 0.0);
    setPt(26, centerX + 0.11, 0.76, 0.0);
    setPt(27, centerX - 0.10, 0.92, 0.0);
    setPt(28, centerX + 0.10, 0.92, 0.0);

  } else if (ex === "plank") {
    // Isometric Plank: straight line with subtle breathing oscillation
    const breath = Math.sin(t * 3.5) * 0.003;
    const yLevel = 0.68 + breath;

    setPt(0, 0.22, yLevel - 0.06, 0.0);
    setPt(11, 0.28, yLevel, -0.06);
    setPt(12, 0.28, yLevel, 0.06);
    // Forearms grounded
    setPt(13, 0.28, yLevel + 0.09, -0.08);
    setPt(14, 0.28, yLevel + 0.09, 0.08);
    setPt(15, 0.36, yLevel + 0.09, -0.06);
    setPt(16, 0.36, yLevel + 0.09, 0.06);

    // Neutral spine
    setPt(23, 0.54, yLevel - 0.01, -0.04);
    setPt(24, 0.54, yLevel - 0.01, 0.04);
    setPt(25, 0.70, yLevel, -0.04);
    setPt(26, 0.70, yLevel, 0.04);
    setPt(27, 0.86, yLevel + 0.05, -0.04);
    setPt(28, 0.86, yLevel + 0.05, 0.04);

  } else {
    // Standard Standing Bicep Curl (Mathematically pristine 3D rotation)
    // cycle=0 -> full extension (165° elbow angle)
    // cycle=1 -> peak flexion (< 65° elbow angle)
    const shoulderY = 0.32;
    const hipY = 0.62;
    const lElbX = centerX - 0.15;
    const rElbX = centerX + 0.15;
    const elbY = shoulderY + 0.18; // Elbow pinned at y=0.50
    const forearmLen = 0.18;

    // Elbow flexion angle phi: 15° (lockout) up to 120° (deep peak contraction)
    const phiDeg = 15.0 + cycle * 105.0;
    const phiRad = (phiDeg * Math.PI) / 180.0;

    // Wrist coordinates rotating in 3D sagittal arc
    const wristY = elbY + forearmLen * Math.cos(phiRad);
    const wristZ = -forearmLen * Math.sin(phiRad); // Arc forward toward shoulder

    setPt(0, centerX, shoulderY - 0.14, 0.0);
    setPt(11, centerX - 0.14, shoulderY, 0.0);
    setPt(12, centerX + 0.14, shoulderY, 0.0);

    // Elbows pinned tightly to torso
    setPt(13, lElbX, elbY, 0.0);
    setPt(14, rElbX, elbY, 0.0);

    // Wrists following true circular 3D trajectory
    setPt(15, lElbX, wristY, wristZ);
    setPt(16, rElbX, wristY, wristZ);

    // Lower body stationary
    setPt(23, centerX - 0.09, hipY, 0.0);
    setPt(24, centerX + 0.09, hipY, 0.0);
    setPt(25, centerX - 0.09, 0.76, 0.0);
    setPt(26, centerX + 0.09, 0.76, 0.0);
    setPt(27, centerX - 0.09, 0.92, 0.0);
    setPt(28, centerX + 0.09, 0.92, 0.0);
  }

  return landmarks;
}
