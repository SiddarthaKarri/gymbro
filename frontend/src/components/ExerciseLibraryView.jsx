import React, { useState } from "react";
import { Search, Dumbbell, ArrowRight, CheckCircle2, AlertTriangle, Shield, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

const CATALOG = [
  {
    id: "bicep_curl", name: "Bicep Curl", category: "isolation", difficulty: "Beginner",
    primaryMuscles: "Biceps Brachii, Brachialis",
    secondaryMuscles: "Brachioradialis, Anterior Deltoid",
    jointChain: "Elbow flexion (Shoulder → Elbow → Wrist)",
    targetDepthAngle: "< 75° peak flexion",
    lockoutAngle: "> 155° full extension",
    biomechanicalStandards: [
      "Keep elbows pinned to your sides throughout — no shoulder swing.",
      "Both arms must stay within 6° of each other for bilateral symmetry.",
      "Fully straighten arms at the bottom before starting the next rep.",
    ],
    failureModes: [
      "Swinging elbows forward to cheat with the shoulder (momentum cheating).",
      "One arm lagging behind the other (dominant side compensation).",
      "Hyperextending the lower back to initiate momentum.",
    ],
    safetyGate: "Detects elbow flare angle and momentum swing.",
  },
  {
    id: "squat", name: "Back Squat", category: "lower", difficulty: "Advanced",
    primaryMuscles: "Quadriceps, Glutes, Adductors",
    secondaryMuscles: "Hamstrings, Core, Calves",
    jointChain: "Knee + hip angle (Hip → Knee → Ankle)",
    targetDepthAngle: "< 95° knee — femur parallel to floor",
    lockoutAngle: "> 160° full standing extension",
    biomechanicalStandards: [
      "Hip crease must descend below the top of the knee (parallel or below).",
      "Knees track over 2nd/3rd toe — no inward caving.",
      "Chest stays upright, lumbar spine neutral throughout.",
    ],
    failureModes: [
      "Knee valgus (knees caving inward) — ACL injury risk.",
      "Butt wink (lumbar rounding at depth) — disc injury risk.",
      "Partial squats — missing depth, reduced muscle activation.",
    ],
    safetyGate: "Knee valgus detector + lumbar flexion alert.",
  },
  {
    id: "deadlift", name: "Conventional Deadlift", category: "lower", difficulty: "Expert",
    primaryMuscles: "Glutes, Hamstrings, Erector Spinae",
    secondaryMuscles: "Lats, Traps, Quads, Forearms",
    jointChain: "Hip hinge angle (Shoulder → Hip → Knee)",
    targetDepthAngle: "< 112° hip hinge at setup",
    lockoutAngle: "> 165° full standing extension",
    biomechanicalStandards: [
      "Bar travels straight up, directly over mid-foot.",
      "Spine stays neutral — no thoracic or lumbar rounding.",
      "Hips and shoulders rise at the same rate from the floor.",
    ],
    failureModes: [
      "Spine rounding under load — disc herniation risk.",
      "Hips shooting up first — converts to a back-dominant lift.",
      "Hyperextending the lower back at lockout.",
    ],
    safetyGate: "Strict spine deviation gate (≤ 18° tolerance).",
  },
  {
    id: "overhead_press", name: "Overhead Press", category: "upper", difficulty: "Intermediate",
    primaryMuscles: "Anterior & Lateral Deltoids, Triceps",
    secondaryMuscles: "Upper Pecs, Serratus, Traps",
    jointChain: "Elbow extension overhead (Shoulder → Elbow → Wrist)",
    targetDepthAngle: "< 90° at rack position (bottom)",
    lockoutAngle: "> 148° full overhead lockout",
    biomechanicalStandards: [
      "Bar starts resting on anterior deltoids / clavicle.",
      "Full bilateral lockout directly overhead.",
      "Core braced — no excessive lumbar arch.",
    ],
    failureModes: [
      "Excessive back arch — turns OHP into incline bench.",
      "Incomplete lockout — triceps or shoulder weakness.",
      "Asymmetric press path.",
    ],
    safetyGate: "Torso inclination + bilateral symmetry gate.",
  },
  {
    id: "push_up", name: "Push-Up", category: "upper", difficulty: "Beginner",
    primaryMuscles: "Pectoralis Major, Triceps, Anterior Deltoids",
    secondaryMuscles: "Core, Serratus Anterior",
    jointChain: "Elbow flexion in plank (Shoulder → Elbow → Wrist)",
    targetDepthAngle: "< 95° elbow — chest near floor",
    lockoutAngle: "> 148° full protracted lockout",
    biomechanicalStandards: [
      "Rigid plank from head to heels — no sagging hips.",
      "Elbows at ~45° to torso, not flared to 90°.",
      "Chest descends before hips or knees.",
    ],
    failureModes: [
      "Hip sag — weak core letting lower back arch.",
      "Elbow flare — anterior shoulder stress.",
      "Half reps — only moving head, no chest depth.",
    ],
    safetyGate: "Hip sag linearity + elbow flare monitor.",
  },
  {
    id: "lateral_raise", name: "Lateral Raise", category: "isolation", difficulty: "Intermediate",
    primaryMuscles: "Lateral Deltoids (middle head)",
    secondaryMuscles: "Supraspinatus, Traps, Serratus",
    jointChain: "Shoulder abduction (Hip → Shoulder → Elbow)",
    targetDepthAngle: "> 75° parallel abduction",
    lockoutAngle: "< 25° at rest (bottom boundary)",
    biomechanicalStandards: [
      "Raise in the scapular plane (slight forward tilt).",
      "Elbows slightly bent and lead the movement.",
      "Zero momentum from the legs or lower back.",
    ],
    failureModes: [
      "Torso swing — using lower back to cheat momentum.",
      "Trap shrugging before deltoid activates.",
      "Raising above 95° — subacromial impingement risk.",
    ],
    safetyGate: "Torso momentum + shrugging detector.",
  },
  {
    id: "lunge", name: "Lunge", category: "lower", difficulty: "Intermediate",
    primaryMuscles: "Quadriceps, Glutes, Hamstrings",
    secondaryMuscles: "Core, Calves, Hip Flexors",
    jointChain: "Lead knee flexion (Hip → Knee → Ankle)",
    targetDepthAngle: "< 100° lead knee flexion",
    lockoutAngle: "> 142° standing extension",
    biomechanicalStandards: [
      "Lead knee tracks over toes without caving inward.",
      "Torso upright, hips level — no lateral tilt.",
      "Rear knee descends toward (but not touching) the floor.",
    ],
    failureModes: [
      "Lead knee caving inward (valgus) under fatigue.",
      "Excessive forward trunk lean — quad dominance.",
      "Rear hip hiking or rotating.",
    ],
    safetyGate: "Knee valgus + trunk tilt detector.",
  },
  {
    id: "bent_over_row", name: "Bent-Over Row", category: "pull", difficulty: "Intermediate",
    primaryMuscles: "Latissimus Dorsi, Rhomboids, Mid-Traps",
    secondaryMuscles: "Biceps, Rear Delts, Spinal Erectors",
    jointChain: "Elbow retraction (Shoulder → Elbow → Wrist)",
    targetDepthAngle: "< 88° elbow at peak pull",
    lockoutAngle: "> 140° full arm extension",
    biomechanicalStandards: [
      "Hinge at hips 45–60° — spine neutral throughout.",
      "Elbows drive back past torso, not flaring outward.",
      "Bar makes contact with the lower abdomen at the top.",
    ],
    failureModes: [
      "Excessive torso rocking — momentum cheating.",
      "Elbows flaring instead of driving back (rear delt instead of lat).",
      "Lumbar rounding under load.",
    ],
    safetyGate: "Torso oscillation + lumbar deviation gate.",
  },
  {
    id: "plank", name: "Plank (Isometric)", category: "core", difficulty: "Beginner",
    primaryMuscles: "Transverse Abdominis, Rectus Abdominis, Core",
    secondaryMuscles: "Glutes, Shoulders, Serratus",
    jointChain: "Hip & spine alignment (Shoulder → Hip → Ankle)",
    targetDepthAngle: "160–185° body alignment (neutral plank)",
    lockoutAngle: "N/A — isometric hold",
    biomechanicalStandards: [
      "Straight line from ears to heels — no sagging or piking.",
      "Hips stay level — no rotation or tipping.",
      "Shoulders directly above wrists/elbows.",
    ],
    failureModes: [
      "Hips sagging (anterior pelvic tilt) — lower back strain.",
      "Hips piking upward — reducing core demand.",
      "Head dropping or craning forward — neck strain.",
    ],
    safetyGate: "Sagging / piking detection via hip alignment angle.",
  },
];

const CATEGORIES = [
  { id: "all",       label: "All" },
  { id: "upper",     label: "Upper Push" },
  { id: "pull",      label: "Pull" },
  { id: "isolation", label: "Isolation" },
  { id: "lower",     label: "Lower Body" },
  { id: "core",      label: "Core" },
];

function ExerciseCard({ item, onSelect, onSim, onLaunch }) {
  const [expanded, setExpanded] = useState(false);
  const diffClass = {
    Beginner: "diff-beginner", Intermediate: "diff-intermediate",
    Advanced: "diff-advanced", Expert: "diff-expert",
  }[item.difficulty] || "diff-beginner";

  return (
    <div className="exercise-lib-card">
      <div className="lib-card-top">
        <div className="lib-card-icon-name">
          <div className="lib-card-icon"><Dumbbell size={16} /></div>
          <div>
            <div className="lib-card-name">{item.name}</div>
            <div className="lib-card-category">{item.category}</div>
          </div>
        </div>
        <span className={`lib-card-difficulty ${diffClass}`}>{item.difficulty}</span>
      </div>

      <div className="lib-joint-chain">
        <span className="joint-box-label">Track</span>
        <span className="joint-box-val">{item.jointChain}</span>
      </div>

      <div className="lib-thresholds-grid">
        <div className="threshold-pill">
          <span className="th-lbl">Target depth</span>
          <span className="th-val text-cyan">{item.targetDepthAngle}</span>
        </div>
        <div className="threshold-pill">
          <span className="th-lbl">Lockout</span>
          <span className="th-val text-emerald">{item.lockoutAngle}</span>
        </div>
      </div>

      <div className="lib-muscles-section">
        <div className="muscle-item">
          <strong>Primary:</strong> <span>{item.primaryMuscles}</span>
        </div>
        <div className="muscle-item">
          <strong>Secondary:</strong> <span>{item.secondaryMuscles}</span>
        </div>
      </div>

      {/* Expandable detail */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "none", border: "none", color: "var(--t-muted)",
          fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", padding: "4px 0",
          marginBottom: "var(--space-3)"
        }}
      >
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {expanded ? "Hide details" : "Show form cues & safety gates"}
      </button>

      {expanded && (
        <>
          <div className="lib-checklist-section">
            <div className="checklist-heading">
              <CheckCircle2 size={12} className="text-emerald" /> Form Criteria
            </div>
            <ul className="standards-list">
              {item.biomechanicalStandards.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          <div className="lib-failures-section" style={{ marginTop: "var(--space-3)" }}>
            <div className="checklist-heading text-rose">
              <AlertTriangle size={12} /> Common Faults
            </div>
            <ul className="failures-list">
              {item.failureModes.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>

          <div className="lib-safety-banner">
            <Shield size={12} color="var(--c-amber)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span><strong>Safety gate:</strong> {item.safetyGate}</span>
          </div>
        </>
      )}

      <div className="lib-card-actions">
        <button className="btn-launch-exercise" onClick={() => { onSelect(item.id); onLaunch(); }}>
          <ArrowRight size={13} /> Start in Studio
        </button>
        <button className="btn-sim-exercise" onClick={() => { onSelect(item.id); onSim(); }}>
          <Sparkles size={13} />
        </button>
      </div>
    </div>
  );
}

export function ExerciseLibraryView({ onSelectExercise, onLaunchLive, onLaunchSimulation }) {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");

  const filtered = CATALOG.filter(ex => {
    const matchCat = category === "all" || ex.category === category;
    const matchQ   = !query || ex.name.toLowerCase().includes(query.toLowerCase());
    return matchCat && matchQ;
  });

  return (
    <div className="exercise-lib-container">
      <div className="exercise-lib-header">
        <div className="history-pill-tag"><Dumbbell size={13} /> 9 exercises supported</div>
        <h1 className="history-page-title">Exercise Library</h1>
        <p className="history-page-desc">
          Select any exercise to see target joint angles, form criteria, and common faults.
          Launch it directly in the studio or run a demo.
        </p>

        <div className="lib-search-bar">
          <div className="search-input-wrap">
            <Search size={14} />
            <input
              type="search"
              placeholder="Search exercises..."
              className="input"
              style={{ paddingLeft: 34 }}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="lib-filter-tabs">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                className={`lib-filter-tab ${category === c.id ? "active" : ""}`}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="exercise-cards-grid">
        {filtered.map(item => (
          <ExerciseCard
            key={item.id}
            item={item}
            onSelect={onSelectExercise}
            onLaunch={onLaunchLive}
            onSim={onLaunchSimulation}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1/-1", padding: "var(--space-10)", textAlign: "center", color: "var(--t-muted)", fontSize: "0.85rem" }}>
            No exercises found for "{query}"
          </div>
        )}
      </div>
    </div>
  );
}
