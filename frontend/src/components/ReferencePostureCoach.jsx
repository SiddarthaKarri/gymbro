import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, AlertTriangle, Target, ChevronLeft, ChevronRight } from "lucide-react";

/* ─── Exercise Profiles ─────────────────────────────────── */
const PROFILES = {
  bicep_curl: {
    name: "Bicep Curl",
    targetAngle: 75, lockoutAngle: 160,
    targetLabel: "≤ 75° flex", lockoutLabel: "≥ 160° extend",
    cues: ["Keep elbows pinned to ribs", "Curl fully to 75°", "Lower slowly with control", "Torso stays upright"],
    fault: "Elbow drift / shoulder swing for momentum",
    // SVG stick figure anchor points (normalized 0–1)
    skeleton: {
      joints: { hip: [0.5,0.65], shoulder: [0.5,0.38], lElbow: [0.34,0.52], rElbow: [0.66,0.52], lWrist: [0.30,0.42], rWrist: [0.70,0.42], head: [0.5,0.20] },
      bones: [["hip","shoulder"],["shoulder","lElbow"],["lElbow","lWrist"],["shoulder","rElbow"],["rElbow","rWrist"],["shoulder","head"]]
    }
  },
  squat: {
    name: "Back Squat",
    targetAngle: 90, lockoutAngle: 165,
    targetLabel: "≤ 90° knee", lockoutLabel: "≥ 165° stand",
    cues: ["Knees track over toes", "Hip crease below knees", "Chest stays upright", "Drive through mid-foot"],
    fault: "Knee valgus (inward caving)",
    skeleton: {
      joints: { head: [0.5,0.12], shoulder: [0.5,0.32], hip: [0.5,0.54], lKnee: [0.36,0.72], rKnee: [0.64,0.72], lAnkle: [0.34,0.90], rAnkle: [0.66,0.90] },
      bones: [["shoulder","head"],["shoulder","hip"],["hip","lKnee"],["lKnee","lAnkle"],["hip","rKnee"],["rKnee","rAnkle"]]
    }
  },
  deadlift: {
    name: "Deadlift",
    targetAngle: 112, lockoutAngle: 165,
    targetLabel: "≤ 112° hip", lockoutLabel: "≥ 165° lockout",
    cues: ["Spine neutral throughout", "Bar stays close to shins", "Hips & shoulders rise together", "Full hip lockout at top"],
    fault: "Lumbar rounding under load",
    skeleton: {
      joints: { head: [0.5,0.18], shoulder: [0.5,0.35], hip: [0.5,0.55], lKnee: [0.38,0.72], rKnee: [0.62,0.72], lAnkle: [0.36,0.88], rAnkle: [0.64,0.88] },
      bones: [["head","shoulder"],["shoulder","hip"],["hip","lKnee"],["lKnee","lAnkle"],["hip","rKnee"],["rKnee","rAnkle"]]
    }
  },
  overhead_press: {
    name: "Overhead Press",
    targetAngle: 90, lockoutAngle: 155,
    targetLabel: "< 90° bottom", lockoutLabel: "≥ 155° overhead",
    cues: ["Bar starts on clavicle", "Press strictly overhead", "Full bilateral lockout", "Core braced, no arch"],
    fault: "Excessive back arch (incline press))",
    skeleton: {
      joints: { hip: [0.5,0.65], shoulder: [0.5,0.40], lElbow: [0.32,0.30], rElbow: [0.68,0.30], lWrist: [0.28,0.14], rWrist: [0.72,0.14], head: [0.5,0.22] },
      bones: [["hip","shoulder"],["shoulder","lElbow"],["lElbow","lWrist"],["shoulder","rElbow"],["rElbow","rWrist"],["shoulder","head"]]
    }
  },
  push_up: {
    name: "Push-Up",
    targetAngle: 90, lockoutAngle: 150,
    targetLabel: "< 95° depth", lockoutLabel: "≥ 150° top",
    cues: ["Rigid plank — no hip sag", "Elbows at 45° to torso", "Chest descends first", "Full protracted lockout"],
    fault: "Hip sag or half reps",
    skeleton: {
      joints: { head: [0.15,0.28], shoulder: [0.30,0.35], lElbow: [0.46,0.42], rElbow: [0.46,0.28], lWrist: [0.62,0.48], rWrist: [0.62,0.22], hip: [0.60,0.38], ankle: [0.88,0.35] },
      bones: [["head","shoulder"],["shoulder","lElbow"],["lElbow","lWrist"],["shoulder","rElbow"],["rElbow","rWrist"],["shoulder","hip"],["hip","ankle"]]
    }
  },
  lateral_raise: {
    name: "Lateral Raise",
    targetAngle: 75, lockoutAngle: 20,
    targetLabel: "≥ 75° abduct", lockoutLabel: "< 25° rest",
    cues: ["Raise in scapular plane", "Elbows lead the movement", "No torso swing", "Stop at shoulder height"],
    fault: "Trap shrug before deltoid fires",
    skeleton: {
      joints: { hip: [0.5,0.65], shoulder: [0.5,0.38], lElbow: [0.22,0.36], rElbow: [0.78,0.36], lWrist: [0.10,0.34], rWrist: [0.90,0.34], head: [0.5,0.20] },
      bones: [["hip","shoulder"],["shoulder","lElbow"],["lElbow","lWrist"],["shoulder","rElbow"],["rElbow","rWrist"],["shoulder","head"]]
    }
  },
  lunge: {
    name: "Lunge",
    targetAngle: 95, lockoutAngle: 165,
    targetLabel: "≤ 100° lead knee", lockoutLabel: "≥ 165° stand",
    cues: ["Lead knee tracks over toes", "Torso upright, hips level", "Rear knee drops toward floor", "Push off lead foot"],
    fault: "Knee valgus under fatigue",
    skeleton: {
      joints: { head: [0.46,0.10], shoulder: [0.46,0.28], hip: [0.46,0.50], lKnee: [0.36,0.68], rKnee: [0.58,0.68], lAnkle: [0.30,0.88], rAnkle: [0.62,0.84] },
      bones: [["head","shoulder"],["shoulder","hip"],["hip","lKnee"],["lKnee","lAnkle"],["hip","rKnee"],["rKnee","rAnkle"]]
    }
  },
  bent_over_row: {
    name: "Bent-Over Row",
    targetAngle: 88, lockoutAngle: 145,
    targetLabel: "< 88° pull", lockoutLabel: "≥ 145° extend",
    cues: ["Hinge at hips 45–60°", "Drive elbows back past torso", "Bar contacts lower abs", "Spine neutral throughout"],
    fault: "Torso rocking / lumbar rounding",
    skeleton: {
      joints: { head: [0.25,0.18], shoulder: [0.40,0.32], hip: [0.55,0.48], lKnee: [0.52,0.70], rKnee: [0.65,0.70], lElbow: [0.30,0.44], rElbow: [0.50,0.44], lWrist: [0.20,0.52], rWrist: [0.42,0.52] },
      bones: [["head","shoulder"],["shoulder","hip"],["hip","lKnee"],["hip","rKnee"],["shoulder","lElbow"],["lElbow","lWrist"],["shoulder","rElbow"],["rElbow","rWrist"]]
    }
  },
  plank: {
    name: "Plank",
    targetAngle: 172, lockoutAngle: 172,
    targetLabel: "160–185° body line", lockoutLabel: "Hold isometric",
    cues: ["Straight line: ears → heels", "Hips level — no sag or pike", "Shoulders over wrists/elbows", "Glutes and core braced"],
    fault: "Hip sagging (anterior pelvic tilt)",
    skeleton: {
      joints: { head: [0.10,0.33], shoulder: [0.26,0.36], hip: [0.56,0.38], lKnee: [0.70,0.40], ankle: [0.88,0.42], elbow: [0.26,0.48], wrist: [0.16,0.50] },
      bones: [["head","shoulder"],["shoulder","hip"],["hip","lKnee"],["lKnee","ankle"],["shoulder","elbow"],["elbow","wrist"]]
    }
  },
};

/* ─── Animated SVG Stick Figure ─────────────────────────── */
function StickFigure({ profile, phase, cycleT }) {
  const W = 280, H = 320;
  const { joints, bones } = profile.skeleton;

  // Map normalized coords to SVG coords
  const pt = (key) => {
    const [nx, ny] = joints[key];
    return [nx * W, ny * H];
  };

  // Subtle breathing animation
  const breathe = Math.sin(cycleT * 2) * 1.5;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ userSelect: "none" }}>
      {/* Background grid */}
      <defs>
        <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0 L0 0 0 28" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
        </pattern>
        <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(99,102,241,0.08)" />
          <stop offset="100%" stopColor="rgba(99,102,241,0)" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" />
      <ellipse cx={W / 2} cy={H / 2} rx={W * 0.55} ry={H * 0.4} fill="url(#glowGrad)" />

      {/* Bones */}
      {bones.map(([a, b], i) => {
        if (!joints[a] || !joints[b]) return null;
        const [x1, y1] = pt(a);
        const [x2, y2] = pt(b);
        return (
          <line
            key={i}
            x1={x1} y1={y1 + breathe}
            x2={x2} y2={y2 + breathe}
            stroke="rgba(129,140,248,0.65)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}

      {/* Joint dots */}
      {Object.entries(joints).map(([key, [nx, ny]]) => (
        <g key={key}>
          <circle
            cx={nx * W} cy={ny * H + breathe}
            r={5}
            fill="#6366f1"
            opacity={0.9}
          />
          <circle
            cx={nx * W} cy={ny * H + breathe}
            r={9}
            fill="rgba(99,102,241,0.15)"
          />
        </g>
      ))}

      {/* Phase label */}
      <text x={W / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="rgba(148,163,184,0.7)" fontFamily="var(--f-mono)">
        {phase}
      </text>
    </svg>
  );
}

/* ─── Comparison row (user vs target) ───────────────────── */
function AngleCompareRow({ label, userVal, targetVal, isPass }) {
  const display = userVal != null ? `${Math.round(userVal)}°` : "--";
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--c-border)" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--t-secondary)" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <span style={{ fontFamily: "var(--f-mono)", fontSize: "0.85rem", fontWeight: 700, color: "var(--t-primary)" }}>{display}</span>
        <span style={{ fontSize: "0.68rem", padding: "1px 6px", borderRadius: "99px", fontWeight: 700,
          background: isPass ? "var(--c-green-dim)" : "var(--c-amber-dim)",
          color: isPass ? "var(--c-green)" : "var(--c-amber)",
          border: `1px solid ${isPass ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}` }}>
          {isPass ? "✓ Good" : "Improve"}
        </span>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export function ReferencePostureCoach({
  exerciseType = "bicep_curl",
  userAngles = null,
  userRepPhase = "LOCKOUT",
  isVoiceEnabled = true,
  onToggleVoice,
}) {
  const [cycleT, setCycleT] = useState(0);
  const [cueIndex, setCueIndex] = useState(0);
  const animRef = useRef(null);

  const profile = PROFILES[exerciseType] || PROFILES.bicep_curl;

  // Animate breathing / phase loop
  useEffect(() => {
    let t = 0;
    const run = () => {
      t += 0.025;
      setCycleT(t);
      animRef.current = requestAnimationFrame(run);
    };
    animRef.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Cycle cues
  useEffect(() => {
    const id = setInterval(() => setCueIndex(i => (i + 1) % profile.cues.length), 3500);
    return () => clearInterval(id);
  }, [profile.cues.length]);

  const angles  = userAngles || {};
  const leftVal  = angles.left_elbow ?? angles.left_knee ?? angles.left_hip_hinge ?? null;
  const rightVal = angles.right_elbow ?? angles.right_knee ?? angles.right_hip_hinge ?? null;

  const isLeftPass  = leftVal  != null && leftVal  <= profile.targetAngle + 10;
  const isRightPass = rightVal != null && rightVal <= profile.targetAngle + 10;

  return (
    <div className="ref-coach-container">
      {/* Header */}
      <div className="ref-coach-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="ref-exercise-name">{profile.name}</div>
            <div className="ref-exercise-sub">Reference posture guide</div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <span style={{ fontSize: "0.68rem", color: "var(--t-muted)", background: "var(--c-surface-2)", border: "1px solid var(--c-border)", padding: "2px 8px", borderRadius: "99px" }}>
              {profile.targetLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Stick figure */}
      <div className="ref-svg-area">
        <StickFigure profile={profile} phase={userRepPhase} cycleT={cycleT} />
        <div className="angle-callout-overlay">
          Target: {profile.targetLabel}
        </div>
      </div>

      {/* Bottom panel */}
      <div className="ref-bottom-panel">
        {/* Live coaching cue */}
        <div className="ref-cue-row" style={{ marginBottom: "var(--space-3)" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-brand-light)", flexShrink: 0, animation: "blink 2s infinite" }} />
          <span className="ref-cue-text" style={{ fontWeight: 500 }}>{profile.cues[cueIndex]}</span>
        </div>

        {/* Cue dots */}
        <div style={{ display: "flex", gap: 4, marginBottom: "var(--space-3)" }}>
          {profile.cues.map((_, i) => (
            <button key={i} onClick={() => setCueIndex(i)} style={{ width: i === cueIndex ? 16 : 6, height: 6, borderRadius: 3, background: i === cueIndex ? "var(--c-brand-light)" : "var(--c-surface-3)", border: "none", cursor: "pointer", transition: "all 0.2s", padding: 0 }} />
          ))}
        </div>

        {/* Live angle comparison (only when tracking active) */}
        {(leftVal != null || rightVal != null) && (
          <div style={{ marginBottom: "var(--space-3)" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.06em", color: "var(--t-muted)", textTransform: "uppercase", marginBottom: "var(--space-2)" }}>
              Live Comparison
            </div>
            {leftVal  != null && <AngleCompareRow label="Left joint"  userVal={leftVal}  targetVal={profile.targetAngle} isPass={isLeftPass} />}
            {rightVal != null && <AngleCompareRow label="Right joint" userVal={rightVal} targetVal={profile.targetAngle} isPass={isRightPass} />}
          </div>
        )}

        {/* Fault to avoid */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-2)", padding: "var(--space-2) var(--space-3)", background: "var(--c-red-dim)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--r-sm)" }}>
          <AlertTriangle size={12} color="var(--c-red)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: "0.72rem", color: "rgba(239,68,68,0.9)" }}>
            <strong>Avoid:</strong> {profile.fault}
          </span>
        </div>
      </div>
    </div>
  );
}
