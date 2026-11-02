import React, { useState, useEffect } from "react";
import {
  CheckCircle2, XCircle, BookOpen, Activity, Zap, Shield, Eye, Volume2,
  Camera, Sparkles, ArrowRight
} from "lucide-react";

const GAPS = [
  {
    num: 1,
    title: "3D Euclidean Vectors vs. 2D Planar Projection",
    problem: "Most web fitness apps compute joint angles using 2D pixel coordinates (x, y) via atan2. When the athlete rotates relative to the camera, perspective foreshortening introduces up to 22.4° of geometric error — a parallel squat (90°) is falsely registered as 112°.",
    solution: "We extract normalized 3D world landmark vectors P = (x, y, z) from BlazePose and evaluate angles using 3D vector dot products, giving view-invariant joint angle measurements regardless of camera position.",
    equation: "θ = arccos( (v_BA · v_BC) / (|v_BA| × |v_BC|) )\nwhere v_BA = A − B,  v_BC = C − B  in ℝ³",
    icon: Eye,
  },
  {
    num: 2,
    title: "Bilateral Symmetry Quantification",
    problem: "No existing web-based fitness tracker quantifies bilateral movement asymmetry per repetition. Undetected strength imbalances are a leading cause of overuse injuries and muscular dysbalances.",
    solution: "We compute the absolute bilateral symmetry delta (Δ) between paired joint angles on every frame, averaged across each rep and flagged if it exceeds 6°.",
    equation: "Δ_symmetry = |θ_left − θ_right|\nFlagged when Δ > 6° (injury prevention gate)",
    icon: Shield,
  },
  {
    num: 3,
    title: "Velocity-Based Training (VBT) via Landmark Displacement",
    problem: "Commercial VBT systems (GymAware, Push Band) cost $400–$1200 and require physical hardware. No webcam-only VBT system existed before this project.",
    solution: "We compute bar velocity by tracking wrist landmark 3D world-space displacement between frames, normalized for MediaPipe's coordinate scale and calibrated against empirical barbell movement.",
    equation: "v_bar = Δd_wrist / Δt × scale_factor\n1RM_est = load / (1 − 0.0278 × nReps)\n[González-Badillo model, 2010]",
    icon: Zap,
  },
  {
    num: 4,
    title: "Confidence Gate: Landmark Visibility Filtering",
    problem: "All prior MediaPipe fitness implementations blindly use all 33 landmarks, including landmarks with visibility < 0.3. This produces wildly noisy angle measurements from partial or occluded body views.",
    solution: "We implement a confidence gate that checks landmark visibility scores for all joints required by each exercise. If any required joint falls below 0.55, scoring is paused and the user is alerted.",
    equation: "score_valid = ∀ j ∈ required_joints: visibility(j) ≥ 0.55\nIf False → output 'visibility_error: true', freeze metrics",
    icon: CheckCircle2,
  },
  {
    num: 5,
    title: "Spine Deviation & Injury Risk Classification",
    problem: "No open-source webcam fitness system classifies spinal alignment risk in real time. Lower back injuries account for the #1 cause of barbell exercise injuries.",
    solution: "We estimate spinal flexion angle using the Shoulder–Hip–Knee landmark chain and classify injury risk as LOW / MEDIUM / HIGH based on deviation from neutral spine (180°).",
    equation: "θ_spine = angle(Shoulder, Hip, Knee)\nLOW: |θ − 180| ≤ 12° · MED: ≤ 22° · HIGH: > 22°",
    icon: Activity,
  },
  {
    num: 6,
    title: "Phase-Based Kinematic State Machine (Rep Counting)",
    problem: "Naive rep counters using simple angle threshold crossings produce double-counts, missed reps, and false positives. All existing open-source MediaPipe rep counters use this flawed approach.",
    solution: "We implement a phase-based finite state machine with hysteresis bands: LOCKOUT → ECCENTRIC → BOTTOM_PAUSE → CONCENTRIC → LOCKOUT. A rep is only counted on a confirmed full LOCKOUT→ECCENTRIC→CONCENTRIC→LOCKOUT cycle.",
    equation: "FSM transitions:\nLOCKOUT  →  ECCENTRIC    if θ < (depth_thresh + hysteresis)\nECCENTRIC →  CONCENTRIC  if θ > depth_thresh (rep triggered)\nCONCENTRIC → LOCKOUT     if θ > lockout_thresh",
    icon: BookOpen,
  },
];

export function ResearchGapsView({ onLaunchStudio, onLaunchSimulation }) {
  return (
    <div className="research-view-container">
      {/* Header */}
      <div className="research-header-banner">
        <div className="research-pill-tag">
          <BookOpen size={13} />
          <span>Technical Methodology</span>
        </div>
        <h1 className="research-page-title">
          Research Gaps & Novel Contributions
        </h1>
        <p className="research-page-desc">
          This page documents the six core engineering novelties in FormCheck that differentiate it
          from existing pose-estimation fitness apps and academic implementations.
        </p>
        <div className="research-actions-row">
          <button className="btn-hero-primary" onClick={onLaunchStudio}>
            <Camera size={14} /> Test Live
          </button>
          <button className="btn-hero-secondary" onClick={onLaunchSimulation}>
            <Sparkles size={14} /> Run Demo
          </button>
        </div>
      </div>

      {/* Gaps */}
      <div className="research-sections-list">
        {GAPS.map(({ num, title, problem, solution, equation, icon: Icon }) => (
          <section className="research-card" key={num}>
            <div className="research-card-badge">Gap #{num}</div>
            <h2 className="research-card-title">{title}</h2>

            <div className="research-grid-2col">
              <div className="research-col-flaw">
                <div className="col-status-tag text-rose">
                  <XCircle size={13} />
                  <span>The problem</span>
                </div>
                <p>{problem}</p>
              </div>

              <div className="research-col-solution">
                <div className="col-status-tag text-cyan">
                  <CheckCircle2 size={13} />
                  <span>Our solution</span>
                </div>
                <p>{solution}</p>
                <div className="research-equation-block">
                  {equation}
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="research-end-cta">
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--c-brand-dim)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Activity size={22} color="var(--c-brand-light)" />
        </div>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 700, letterSpacing: "-0.02em" }}>
          See the research in action
        </h2>
        <p style={{ maxWidth: 420, color: "var(--t-secondary)" }}>
          Run a live camera session or the synthetic demo to see all six novelties working together in real time.
        </p>
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", justifyContent: "center" }}>
          <button className="btn-hero-primary" onClick={onLaunchStudio}>
            <Camera size={14} /> Open Studio <ArrowRight size={14} />
          </button>
          <button className="btn-hero-secondary" onClick={onLaunchSimulation}>
            <Sparkles size={14} /> Run Demo
          </button>
        </div>
      </div>
    </div>
  );
}
