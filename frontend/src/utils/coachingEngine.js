/**
 * Advanced Biomechanical Real-Time Form Coaching & Prescriptive Speech Engine
 * Specifically engineered to intervene proactively so degraded resistance sets are avoided.
 * Supports 9 major resistance movements:
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

export function analyzeFormCorrections({
  angles,
  repPhase,
  exerciseType = "bicep_curl",
  landmarks,
  width,
  height,
  vbt = null,
  injuryRisk = "LOW",
}) {
  if (!angles || !landmarks) {
    return {
      mainCue: "Position yourself in full view of the camera",
      cueSeverity: "info",
      targetCorrections: [],
      voiceCue: null,
    };
  }

  const corrections = [];
  let mainCue = "Good alignment. Ready to lift.";
  let cueSeverity = "info"; // 'info' | 'warn' | 'success' | 'alert'
  let voiceCue = null;

  const leftElbow = angles.left_elbow ?? 160;
  const rightElbow = angles.right_elbow ?? 160;
  const symmetryDelta = angles.symmetry_delta ?? 0;
  const leftShoulderAbduct = angles.left_shoulder_abduction ?? 15;
  const rightShoulderAbduct = angles.right_shoulder_abduction ?? 15;
  const spineAngle = angles.spine_angle ?? 180;
  const kneeValgus = angles.knee_valgus_delta ?? 0;

  const lWristLm = landmarks[15]; // LEFT_WRIST
  const rWristLm = landmarks[16]; // RIGHT_WRIST
  const lElbLm = landmarks[13];
  const rElbLm = landmarks[14];

  // 0. High Injury Risk / Severe Spine Flexion Guard
  if (injuryRisk === "HIGH" || Math.abs(spineAngle - 180) > 28) {
    mainCue = "Spine alignment warning! Straighten your spine and brace your core";
    cueSeverity = "alert";
    voiceCue = "Straighten your spine, do not round your back";
    return { mainCue, cueSeverity, targetCorrections: corrections, voiceCue };
  }

  // Check VBT Neuromuscular Fatigue (>20% Velocity Loss)
  const velLoss = vbt?.velocity_loss_pct ?? 0;
  const isFatigueAlert = velLoss >= 20.0;

  const ex = exerciseType.toLowerCase();

  // =========================================================================
  // 1. STANDING BICEP CURL
  // =========================================================================
  if (ex === "bicep_curl") {
    if (repPhase === "LOCKOUT") {
      if (leftElbow < 145 || rightElbow < 145) {
        mainCue = "Straighten your elbows completely before starting the next rep";
        cueSeverity = "warn";
        voiceCue = "Straighten your elbows completely";
        if (leftElbow < 145 && lElbLm) {
          corrections.push({ joint: "left_elbow", cue: "▼ STRAIGHTEN ELBOW", x: lElbLm.x * width, y: lElbLm.y * height, color: "#f59e0b" });
        }
        if (rightElbow < 145 && rElbLm) {
          corrections.push({ joint: "right_elbow", cue: "▼ STRAIGHTEN ELBOW", x: rElbLm.x * width, y: rElbLm.y * height, color: "#f59e0b" });
        }
      } else if (isFatigueAlert) {
        mainCue = `20% Velocity Loss detected! High fatigue: prepare to finish set`;
        cueSeverity = "warn";
        voiceCue = "Fatigue detected, keep elbows steady";
      } else {
        mainCue = "Elbows locked out. Initiate curl: drive forearms upward";
        cueSeverity = "info";
      }
    } else if (repPhase === "CONCENTRIC") {
      if (symmetryDelta > 5.5) {
        cueSeverity = "warn";
        if (leftElbow > rightElbow) {
          const gap = Math.round(leftElbow - rightElbow);
          mainCue = `Lift your left elbow higher! Lagging by ${gap}°`;
          voiceCue = "Lift your left elbow higher";
          if (lWristLm) {
            corrections.push({ joint: "left_wrist", cue: `▲ LIFT LEFT +${gap}°`, x: lWristLm.x * width, y: lWristLm.y * height, color: "#f59e0b" });
          }
        } else {
          const gap = Math.round(rightElbow - leftElbow);
          mainCue = `Lift your right elbow higher! Lagging by ${gap}°`;
          voiceCue = "Lift your right elbow higher";
          if (rWristLm) {
            corrections.push({ joint: "right_wrist", cue: `▲ LIFT RIGHT +${gap}°`, x: rWristLm.x * width, y: rWristLm.y * height, color: "#f59e0b" });
          }
        }
      } else if (leftShoulderAbduct > 35 || rightShoulderAbduct > 35) {
        mainCue = "Tuck your elbows into your ribs, stop flaring your arms";
        cueSeverity = "warn";
        voiceCue = "Tuck your elbows into your ribs";
      } else {
        const avgElbow = (leftElbow + rightElbow) / 2;
        if (avgElbow > 90) {
          const needed = Math.round(avgElbow - 90);
          mainCue = `Drive higher! Break 90 degrees (+${needed}° needed)`;
          voiceCue = "Lift your bicep higher, break 90 degrees";
          if (lWristLm) corrections.push({ joint: "left_wrist", cue: `▲ +${needed}°`, x: lWristLm.x * width, y: lWristLm.y * height, color: "#00f2fe" });
          if (rWristLm) corrections.push({ joint: "right_wrist", cue: `▲ +${needed}°`, x: rWristLm.x * width, y: rWristLm.y * height, color: "#00f2fe" });
        } else {
          mainCue = "Great concentric drive! Power through to full contraction";
          cueSeverity = "info";
        }
      }
    } else if (repPhase === "BOTTOM_PAUSE") {
      const avgElbow = (leftElbow + rightElbow) / 2;
      if (avgElbow <= 90) {
        mainCue = "Optimal depth reached! Squeeze your biceps at the peak";
        cueSeverity = "success";
        voiceCue = "Squeeze your biceps at the peak";
      } else {
        const miss = Math.round(avgElbow - 90);
        mainCue = `Incomplete depth! You missed 90 degrees by ${miss}°`;
        cueSeverity = "warn";
        voiceCue = "Lift your bicep higher, break 90 degrees";
      }
    } else if (repPhase === "ECCENTRIC") {
      if (symmetryDelta > 7.0) {
        mainCue = "Lower both arms at the same steady speed";
        cueSeverity = "warn";
        voiceCue = "Lower both arms evenly";
      } else {
        mainCue = "Control the eccentric descent, straighten your elbows fully at bottom";
        cueSeverity = "info";
      }
    }
  }

  // =========================================================================
  // 2. BARBELL BACK SQUAT
  // =========================================================================
  else if (ex === "squat") {
    const lKnee = angles.left_knee ?? 170;
    const rKnee = angles.right_knee ?? 170;
    const avgKnee = (lKnee + rKnee) / 2;

    if (kneeValgus > 12) {
      mainCue = "Push your knees outward! Do not let your knees cave in";
      cueSeverity = "warn";
      voiceCue = "Push your knees outward";
    } else if (Math.abs(spineAngle - 180) > 24) {
      mainCue = "Keep your chest up and spine straight! Avoid bending forward";
      cueSeverity = "warn";
      voiceCue = "Straighten your spine, chest up";
    } else if (repPhase === "ECCENTRIC") {
      if (avgKnee > 95) {
        const depthNeeded = Math.round(avgKnee - 90);
        mainCue = `Sink your hips lower: +${depthNeeded}° needed to hit parallel`;
        voiceCue = "Sink your hips lower to parallel";
      } else {
        mainCue = "Parallel depth achieved! Drive through your heels";
        cueSeverity = "success";
      }
    } else if (repPhase === "BOTTOM_PAUSE") {
      mainCue = "Depth hit! Drive forcefully through your heels, straighten knees";
      cueSeverity = "success";
      voiceCue = "Drive up, straighten your knees";
    } else if (repPhase === "CONCENTRIC") {
      mainCue = "Drive your hips through to a full standing lockout";
      cueSeverity = "info";
    }
  }

  // =========================================================================
  // 3. OVERHEAD MILITARY PRESS (OHP)
  // =========================================================================
  else if (ex === "overhead_press" || ex === "ohp") {
    const avgElbow = (leftElbow + rightElbow) / 2;
    if (Math.abs(spineAngle - 180) > 20) {
      mainCue = "Brace your core, do not arch your lower back";
      cueSeverity = "warn";
      voiceCue = "Straighten your back, brace your core";
    } else if (repPhase === "CONCENTRIC") {
      if (avgElbow < 155) {
        mainCue = "Press all the way up! Straighten your arms and lock out elbows";
        voiceCue = "Straighten your arms, lock out elbows overhead";
      } else {
        mainCue = "Full overhead lockout achieved! Lower with control";
        cueSeverity = "success";
      }
    } else if (repPhase === "ECCENTRIC") {
      mainCue = "Lower bar with elbows angled slightly forward in front of ribs";
      cueSeverity = "info";
    }
  }

  // =========================================================================
  // 4. CONVENTIONAL DEADLIFT
  // =========================================================================
  else if (ex === "deadlift") {
    if (Math.abs(spineAngle - 180) > 22) {
      mainCue = "Lumbar flexion warning! Straighten your spine, do not round your back";
      cueSeverity = "warn";
      voiceCue = "Straighten your spine, flatten your back";
    } else if (repPhase === "CONCENTRIC") {
      mainCue = "Push the floor away and drive your hips forward to lock out";
      cueSeverity = "info";
      voiceCue = "Drive your hips forward, straighten up";
    } else if (repPhase === "LOCKOUT") {
      mainCue = "Stand tall, squeeze your glutes, avoid hyperextending";
      cueSeverity = "success";
    }
  }

  // =========================================================================
  // 5. PUSH-UP / BENCH PRESS
  // =========================================================================
  else if (ex === "push_up" || ex === "pushup") {
    const avgElbow = (leftElbow + rightElbow) / 2;
    if (Math.abs(spineAngle - 180) > 18) {
      mainCue = "Brace your core! Straighten your body and do not let your hips sag";
      cueSeverity = "warn";
      voiceCue = "Straighten your body, do not sag";
    } else if (repPhase === "ECCENTRIC") {
      if (avgElbow > 90) {
        mainCue = "Lower chest all the way down until elbows reach 90 degrees";
        voiceCue = "Lower chest to 90 degrees";
      } else {
        mainCue = "Full depth hit! Explode up through your palms";
        cueSeverity = "success";
      }
    } else if (repPhase === "CONCENTRIC") {
      mainCue = "Push the ground away, full elbow extension at top";
      cueSeverity = "info";
      if (avgElbow >= 150) {
        voiceCue = "Straighten elbows completely at top";
      }
    }
  }

  // =========================================================================
  // 6. DUMBBELL LATERAL RAISE
  // =========================================================================
  else if (ex === "lateral_raise") {
    const avgAbduct = (leftShoulderAbduct + rightShoulderAbduct) / 2;
    if (repPhase === "CONCENTRIC") {
      if (avgAbduct > 102) {
        mainCue = "Do not swing past shoulder height! Avoid shrugging your traps";
        cueSeverity = "warn";
        voiceCue = "Stop at shoulder height, don't shrug";
      } else if (avgAbduct < 75) {
        mainCue = "Lift dumbbells higher to shoulder parallel level";
        voiceCue = "Raise dumbbells to shoulder height";
      } else {
        mainCue = "Parallel abduction hit! Hold and squeeze lateral delts";
        cueSeverity = "success";
        voiceCue = "Hold peak, squeeze shoulders";
      }
    } else if (repPhase === "ECCENTRIC") {
      mainCue = "Lower weights smoothly back to your hips";
      cueSeverity = "info";
    } else if (repPhase === "LOCKOUT") {
      mainCue = "Arms at rest. Initiate raise outward in frontal plane";
      cueSeverity = "info";
    }
  }

  // =========================================================================
  // 7. SPLIT LUNGE
  // =========================================================================
  else if (ex === "lunge") {
    const lKnee = angles.left_knee ?? 170;
    const rKnee = angles.right_knee ?? 170;
    const leadKnee = Math.min(lKnee, rKnee);

    if (Math.abs(spineAngle - 180) > 22) {
      mainCue = "Keep your torso tall! Avoid leaning excessively forward";
      cueSeverity = "warn";
      voiceCue = "Torso upright, chest tall";
    } else if (repPhase === "ECCENTRIC") {
      if (leadKnee > 98) {
        mainCue = "Sink deeper: lower your front thigh until parallel to floor";
        voiceCue = "Sink front knee to 90 degrees";
      } else {
        mainCue = "Full 90° lunge depth achieved! Drive through front heel";
        cueSeverity = "success";
        voiceCue = "Drive up through front heel";
      }
    } else if (repPhase === "CONCENTRIC") {
      mainCue = "Push back to standing position with full hip extension";
      cueSeverity = "info";
    }
  }

  // =========================================================================
  // 8. BENT-OVER BARBELL/DUMBBELL ROW
  // =========================================================================
  else if (ex === "bent_over_row") {
    const avgElbow = (leftElbow + rightElbow) / 2;
    if (Math.abs(spineAngle - 180) > 20) {
      mainCue = "Spine warning: maintain flat lumbar back, do not hunch";
      cueSeverity = "warn";
      voiceCue = "Straighten your back, hinge at hips";
    } else if (repPhase === "CONCENTRIC") {
      if (avgElbow > 90) {
        mainCue = "Pull elbows higher! Drive elbows past your ribs";
        voiceCue = "Pull elbows back to ribs";
      } else {
        mainCue = "Full back contraction! Squeeze shoulder blades together";
        cueSeverity = "success";
        voiceCue = "Squeeze shoulder blades";
      }
    } else if (repPhase === "ECCENTRIC") {
      mainCue = "Lower with control, keep your torso stationary";
      cueSeverity = "info";
    }
  }

  // =========================================================================
  // 9. ISOMETRIC CORE PLANK
  // =========================================================================
  else if (ex === "plank") {
    const hipAngle = (angles.left_hip_hinge ?? 180 + angles.right_hip_hinge ?? 180) / 2;
    if (hipAngle < 155) {
      mainCue = "Hip alignment warning: tighten glutes and abs, do not sag or pike";
      cueSeverity = "warn";
      voiceCue = "Straighten your plank line, brace core";
    } else {
      mainCue = "Optimal neutral plank held! Breathe steadily and brace abs";
      cueSeverity = "success";
      voiceCue = "Great plank hold, keep breathing";
    }
  }

  return {
    mainCue,
    cueSeverity,
    targetCorrections: corrections,
    voiceCue,
  };
}
