import React from "react";
import {
  Activity, Wifi, WifiOff, Gauge, Dumbbell, Layers, Sparkles,
  Camera, CameraOff, Play, Square, BarChart3, AlertTriangle,
  RotateCcw, Target, Zap, HeartPulse, Volume2, VolumeX, Minus, Plus
} from "lucide-react";

const EXERCISE_CONFIG = {
  bicep_curl:     { name: "Bicep Curl",        leftLabel: "Left Elbow",   rightLabel: "Right Elbow",   target: "≤ 75°", getValues: a => ({ l: a.left_elbow,  r: a.right_elbow }),  isPass: v => v != null && v <= 85,  passText: "Full flex", failText: "Curl higher" },
  squat:          { name: "Back Squat",         leftLabel: "Left Knee",    rightLabel: "Right Knee",    target: "≤ 95°", getValues: a => ({ l: a.left_knee,   r: a.right_knee }),   isPass: v => v != null && v <= 95,  passText: "Parallel ✓", failText: "Squat deeper" },
  deadlift:       { name: "Deadlift",           leftLabel: "Left Hip",     rightLabel: "Right Hip",     target: "≤ 112°",getValues: a => ({ l: a.left_hip_hinge, r: a.right_hip_hinge }), isPass: v => v != null && v <= 112, passText: "Depth ✓", failText: "Hinge more" },
  overhead_press: { name: "Overhead Press",     leftLabel: "Left Elbow",   rightLabel: "Right Elbow",   target: "≥ 148°",getValues: a => ({ l: a.left_elbow,  r: a.right_elbow }),  isPass: v => v != null && v >= 148, passText: "Locked out ✓", failText: "Press higher" },
  ohp:            { name: "Overhead Press",     leftLabel: "Left Elbow",   rightLabel: "Right Elbow",   target: "≥ 148°",getValues: a => ({ l: a.left_elbow,  r: a.right_elbow }),  isPass: v => v != null && v >= 148, passText: "Locked out ✓", failText: "Press higher" },
  push_up:        { name: "Push-Up",            leftLabel: "Left Elbow",   rightLabel: "Right Elbow",   target: "≤ 95°", getValues: a => ({ l: a.left_elbow,  r: a.right_elbow }),  isPass: v => v != null && v <= 95,  passText: "Full depth ✓", failText: "Lower chest" },
  pushup:         { name: "Push-Up",            leftLabel: "Left Elbow",   rightLabel: "Right Elbow",   target: "≤ 95°", getValues: a => ({ l: a.left_elbow,  r: a.right_elbow }),  isPass: v => v != null && v <= 95,  passText: "Full depth ✓", failText: "Lower chest" },
  lateral_raise:  { name: "Lateral Raise",      leftLabel: "Left Shoulder",rightLabel: "Right Shoulder",target: "≥ 75°", getValues: a => ({ l: a.left_shoulder_abduction, r: a.right_shoulder_abduction }), isPass: v => v != null && v >= 75, passText: "Parallel ✓", failText: "Raise higher" },
  lunge:          { name: "Lunge",              leftLabel: "Left Knee",    rightLabel: "Right Knee",    target: "≤ 100°",getValues: a => ({ l: a.left_knee,   r: a.right_knee }),   isPass: v => v != null && v <= 100, passText: "Full depth ✓", failText: "Drop deeper" },
  bent_over_row:  { name: "Bent-Over Row",      leftLabel: "Left Elbow",   rightLabel: "Right Elbow",   target: "≤ 88°", getValues: a => ({ l: a.left_elbow,  r: a.right_elbow }),  isPass: v => v != null && v <= 88,  passText: "Peak pull ✓", failText: "Pull higher" },
  plank:          { name: "Plank",              leftLabel: "Left Hip",     rightLabel: "Right Hip",     target: "160–185°",getValues: a => ({ l: a.left_hip_hinge, r: a.right_hip_hinge }), isPass: v => v != null && v >= 160 && v <= 185, passText: "Neutral ✓", failText: "Fix alignment" },
};

function QualityRing({ score }) {
  const r = 24, c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const offset = c - (pct / 100) * c;
  const color = pct >= 85 ? "var(--c-green)" : pct >= 70 ? "var(--c-amber)" : "var(--c-red)";
  return (
    <div className="quality-ring-wrapper">
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle className="quality-ring-bg" cx="30" cy="30" r={r} />
        <circle className="quality-ring-fg" cx="30" cy="30" r={r}
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="quality-ring-text" style={{ color, fontSize: "0.8rem" }}>
        {score > 0 ? Math.round(score) : "--"}
      </div>
    </div>
  );
}

export function TelemetryHUD({
  connectionStatus, latestFeedback, rttMs, streamStats,
  exerciseType, setExerciseType,
  isCameraActive, isMockMode,
  showWireframe, setShowWireframe,
  visualStyle, setVisualStyle,
  isVoiceEnabled, setIsVoiceEnabled,
  isSoundEnabled = true, setIsSoundEnabled,
  weightKg = 40, setWeightKg,
  isSetActive, onStartSet, onEndSet, onViewAnalytics,
  onStartCamera, onStopCamera, onToggleMock, onReconnectWs,
}) {
  const feedback    = latestFeedback || {};
  const quality     = feedback.quality_score ?? 0;
  const repPhase    = feedback.rep_phase ?? "LOCKOUT";
  const repCount    = feedback.rep_count ?? 0;
  const angles      = feedback.angles || {};
  const vbt         = feedback.vbt || {};
  const injuryRisk  = feedback.injury_risk || "LOW";
  const visErr      = Boolean(feedback.visibility_error);
  const lastRep     = feedback.last_rep;
  const powerWatts  = feedback.power_watts ?? 0;
  const est1rm      = feedback.estimated_1rm_kg ?? 0;
  const velLoss     = lastRep?.velocity_loss_pct ?? 0;
  const symmetry    = angles.symmetry_delta ?? 0;
  const spineAngle  = angles.spine_angle ? Math.round(angles.spine_angle) : 180;
  const wristVel    = vbt.wrist_velocity_mps ?? 0;
  const isFatigue   = velLoss >= 20;

  const isConnected = connectionStatus === "connected";
  const cfg = EXERCISE_CONFIG[exerciseType] || EXERCISE_CONFIG.bicep_curl;
  const vals = cfg.getValues(angles);

  return (
    <aside className="telemetry-panel">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Dumbbell size={14} color="var(--c-brand-light)" />
          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--t-primary)" }}>Live Tracking</span>
        </div>
        <div
          className={`conn-status-pill ${isConnected ? "conn-online" : "conn-offline"}`}
          onClick={!isConnected ? onReconnectWs : undefined}
          title={isConnected ? "Connected" : "Click to reconnect"}
        >
          {isConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
          {isConnected ? "Live" : "Offline"}
          {!isConnected && <RotateCcw size={9} className="reconnect-hint" />}
        </div>
      </div>

      {/* Rep Counter + Set Control */}
      <div className="t-card">
        <div className="t-section-title"><Activity size={11} /> Repetitions</div>
        <div className="rep-display">
          <div>
            <div className="rep-count-big">{String(repCount).padStart(2, "0")}</div>
            <div style={{ marginTop: 4 }}>
              <span className={`phase-tag phase-${repPhase.toLowerCase()}`}>{repPhase}</span>
            </div>
          </div>
          <div className="rep-actions">
            {isSetActive ? (
              <button className="btn btn-sm btn-finish-set" onClick={onEndSet} style={{ width: "100%" }}>
                <Square size={11} /> End Set
              </button>
            ) : (
              <button className="btn btn-sm btn-start-set" onClick={onStartSet} style={{ width: "100%" }}>
                <Play size={11} /> Start Set
              </button>
            )}
            <button className="btn btn-sm btn-ghost" onClick={onViewAnalytics} style={{ width: "100%", justifyContent: "center" }}>
              <BarChart3 size={11} /> View Analytics
            </button>
          </div>
        </div>

        {/* Last rep summary */}
        {lastRep && (
          <div className="last-rep-strip" style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--c-border)" }}>
            <span style={{ color: "var(--t-muted)", fontSize: "0.68rem", fontWeight: 600 }}>REP #{lastRep.rep_number}</span>
            <span className="last-rep-item-val">{lastRep.quality_score}%</span>
            <span className="last-rep-item-val">{lastRep.peak_depth_angle}°</span>
            <span className="last-rep-item-val last-rep-vbt">{lastRep.mean_velocity_mps} m/s</span>
          </div>
        )}
      </div>

      {/* Form Quality */}
      <div className="t-card">
        <div className="t-section-title"><Gauge size={11} /> Form Quality</div>
        <div className="quality-display">
          <QualityRing score={quality} />
          <div className="quality-details">
            <div className="quality-label-row">
              <span style={{ fontSize: "0.72rem", color: "var(--t-secondary)" }}>
                {quality >= 85 ? "Great form" : quality >= 70 ? "Room to improve" : "Fix your form"}
              </span>
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--t-muted)" }}>
              Symmetry: <span style={{ color: symmetry <= 5 ? "var(--c-green)" : "var(--c-amber)", fontWeight: 600 }}>Δ{symmetry}°</span>
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--t-muted)", marginTop: 2 }}>
              Spine: <span style={{ color: Math.abs(spineAngle - 180) > 20 ? "var(--c-red)" : "var(--c-green)", fontWeight: 600 }}>
                {Math.abs(spineAngle - 180) > 20 ? "Rounded" : "Neutral"}
              </span>
            </div>
          </div>
        </div>

        {injuryRisk === "HIGH" && (
          <div className="injury-warning-card" style={{ marginTop: "var(--space-3)" }}>
            <AlertTriangle size={14} color="var(--c-red)" />
            <span className="injury-warning-text">Spine alert — straighten your back</span>
          </div>
        )}
      </div>

      {/* Joint Guidance */}
      <div className="t-card">
        <div className="t-section-title" style={{ marginBottom: "var(--space-3)" }}>
          <Target size={11} /> {cfg.name} · Target {cfg.target}
        </div>
        <div className="guidance-row">
          {[["l", cfg.leftLabel], ["r", cfg.rightLabel]].map(([side, label]) => {
            const val = vals[side];
            const pass = cfg.isPass(val);
            return (
              <div className="guidance-joint-line" key={side}>
                <span className="guidance-joint-name">{label}</span>
                <div className="guidance-joint-right">
                  <span className="guidance-angle-val">{val != null ? `${Math.round(val)}°` : "--"}</span>
                  <span className={pass ? "tag-pass" : "tag-short"}>{pass ? cfg.passText : cfg.failText}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* VBT */}
      <div className="t-card">
        <div className="t-section-title"><Zap size={11} /> Velocity & Power</div>
        <div className="vbt-strip">
          <div className="vbt-metric">
            <span className="vbt-metric-name">Live velocity</span>
            <span className="vbt-metric-val">{wristVel > 0 ? wristVel.toFixed(2) : "--"}<span className="vbt-metric-unit"> m/s</span></span>
          </div>
          <div className="vbt-metric">
            <span className="vbt-metric-name">Last rep</span>
            <span className="vbt-metric-val">{lastRep?.mean_velocity_mps || "--"}<span className="vbt-metric-unit"> m/s</span></span>
          </div>
          <div className="vbt-metric">
            <span className="vbt-metric-name">Power</span>
            <span className="vbt-metric-val">{powerWatts > 0 ? Math.round(powerWatts) : "--"}<span className="vbt-metric-unit"> W</span></span>
          </div>
          <div className="vbt-metric">
            <span className="vbt-metric-name">Est. 1RM</span>
            <span className="vbt-metric-val">{est1rm > 0 ? est1rm : "--"}<span className="vbt-metric-unit"> kg</span></span>
          </div>
        </div>
        {isFatigue && (
          <div className="fatigue-alert" style={{ marginTop: "var(--space-3)" }}>
            <Zap size={12} />
            <span>{velLoss.toFixed(0)}% velocity drop — consider ending set</span>
          </div>
        )}
      </div>

      {/* Exercise + Load */}
      <div className="t-card">
        <div className="t-section-title"><Layers size={11} /> Exercise & Load</div>
        <div className="ex-select-control">
          <label className="label">Exercise</label>
          <select className="select" value={exerciseType} onChange={e => setExerciseType(e.target.value)}>
            <optgroup label="Arms & Shoulders">
              <option value="bicep_curl">Bicep Curl</option>
              <option value="overhead_press">Overhead Press</option>
              <option value="lateral_raise">Lateral Raise</option>
              <option value="bent_over_row">Bent-Over Row</option>
            </optgroup>
            <optgroup label="Chest & Triceps">
              <option value="push_up">Push-Up</option>
            </optgroup>
            <optgroup label="Lower Body">
              <option value="squat">Back Squat</option>
              <option value="deadlift">Deadlift</option>
              <option value="lunge">Lunge</option>
            </optgroup>
            <optgroup label="Core">
              <option value="plank">Plank</option>
            </optgroup>
          </select>

          <label className="label" style={{ marginTop: "var(--space-3)" }}>Working weight</label>
          <div className="weight-stepper">
            <button className="btn-stepper" onClick={() => setWeightKg?.(Math.max(0, weightKg - 5))}>
              <Minus size={12} />
            </button>
            <span className="weight-stepper-val">{weightKg} kg</span>
            <button className="btn-stepper" onClick={() => setWeightKg?.(weightKg + 5)}>
              <Plus size={12} />
            </button>
          </div>
          <input
            type="range" min="0" max="250" step="2.5"
            value={weightKg}
            onChange={e => setWeightKg?.(parseFloat(e.target.value) || 0)}
            className="range-input"
            style={{ marginTop: "var(--space-2)" }}
          />
        </div>
      </div>

      {/* Camera Controls */}
      <div className="t-card">
        <div className="t-section-title"><Camera size={11} /> Camera</div>
        <div className="cam-controls">
          {isCameraActive ? (
            <button className="btn btn-sm btn-cam-stop" onClick={onStopCamera} style={{ width: "100%", gridColumn: "span 2" }}>
              <CameraOff size={13} /> Stop Camera
            </button>
          ) : (
            <button className="btn btn-sm btn-cam-start" onClick={onStartCamera} style={{ width: "100%" }}>
              <Camera size={13} /> Camera
            </button>
          )}
          <button
            className={`btn btn-sm btn-simulate ${isMockMode ? "active" : ""}`}
            onClick={onToggleMock}
            style={{ width: "100%", ...(isCameraActive ? { gridColumn: "span 2" } : {}) }}
          >
            <Sparkles size={13} />
            {isMockMode ? "Stop Demo" : "Run Demo"}
          </button>
        </div>

        <div className="audio-row" style={{ marginTop: "var(--space-3)" }}>
          <button
            className={`btn-toggle-audio ${isVoiceEnabled ? "on" : ""}`}
            onClick={() => setIsVoiceEnabled?.(v => !v)}
          >
            {isVoiceEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            Voice
          </button>
          <button
            className={`btn-toggle-audio ${isSoundEnabled ? "on" : ""}`}
            onClick={() => setIsSoundEnabled?.(s => !s)}
          >
            {isSoundEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            Sounds
          </button>
        </div>
      </div>
    </aside>
  );
}
