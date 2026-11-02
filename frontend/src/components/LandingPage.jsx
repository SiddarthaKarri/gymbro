import React from "react";
import { Camera, Sparkles, Activity, BarChart2, Dumbbell, ArrowRight, Check } from "lucide-react";

const EXERCISES = [
  { id: "bicep_curl",    name: "Bicep Curl",        target: "≤ 75° flexion",     group: "Arms" },
  { id: "squat",         name: "Back Squat",         target: "≤ 95° knee depth",  group: "Legs" },
  { id: "deadlift",      name: "Deadlift",           target: "≤ 112° hip hinge",  group: "Legs" },
  { id: "overhead_press",name: "Overhead Press",     target: "≥ 148° lockout",    group: "Push" },
  { id: "push_up",       name: "Push-Up",            target: "≤ 95° elbow depth", group: "Push" },
  { id: "lateral_raise", name: "Lateral Raise",      target: "≥ 75° abduction",   group: "Arms" },
  { id: "lunge",         name: "Lunge",              target: "≤ 100° knee",       group: "Legs" },
  { id: "bent_over_row", name: "Bent-Over Row",      target: "≤ 88° pull",        group: "Pull" },
  { id: "plank",         name: "Plank",              target: "160–185° alignment", group: "Core" },
];

const FEATURES = [
  {
    icon: Activity,
    iconClass: "feature-icon-brand",
    title: "Real-Time Rep Counting",
    desc: "Biomechanical state machine tracks every rep with precise phase detection — concentric, eccentric, lockout."
  },
  {
    icon: BarChart2,
    iconClass: "feature-icon-green",
    title: "Velocity-Based Training",
    desc: "Live bar velocity, power output, and 1RM prediction using the González-Badillo sports science model."
  },
  {
    icon: Dumbbell,
    iconClass: "feature-icon-cyan",
    title: "Form Scoring & Coaching",
    desc: "Per-rep quality scores with bilateral symmetry tracking, spine deviation alerts, and real-time voice guidance."
  },
  {
    icon: Camera,
    iconClass: "feature-icon-amber",
    title: "Works with Any Webcam",
    desc: "Uses your device camera — no special equipment needed. Or run a simulated demo without any camera at all."
  },
];

export function LandingPage({ onLaunchLive, onLaunchSimulation, onSelectExercise, onNavigateToExercises, onNavigateToAnalytics, onNavigateToHistory }) {
  return (
    <div className="landing-page-container">
      {/* HERO */}
      <section className="hero-section">
        <div className="hero-eyebrow">
          <span className="conn-dot online" style={{ margin: 0 }} />
          AI-powered workout analysis · 9 exercises supported
        </div>

        <h1 className="hero-title">
          Track your form,<br />
          <span className="hero-title-gradient">lift smarter.</span>
        </h1>

        <p className="hero-subtitle">
          FormCheck analyzes your movement in real time using your webcam, counts reps, scores your form,
          and coaches you on technique — all privately, on your device.
        </p>

        <div className="hero-actions">
          <button
            className="btn btn-primary btn-xl"
            onClick={onLaunchLive}
            style={{ minWidth: 160 }}
          >
            <Camera size={16} />
            Start with Camera
          </button>
          <button
            className="btn btn-secondary btn-xl"
            onClick={onLaunchSimulation}
            style={{ minWidth: 160 }}
          >
            <Sparkles size={16} />
            Try Demo (No Camera)
          </button>
        </div>

        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-num">9</span>
            <span className="hero-stat-label">Exercises</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-num">25 FPS</span>
            <span className="hero-stat-label">Analysis speed</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-num">3D</span>
            <span className="hero-stat-label">Joint tracking</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-num">100%</span>
            <span className="hero-stat-label">Private & local</span>
          </div>
        </div>
      </section>

      <div className="landing-divider" />

      {/* FEATURES */}
      <section className="features-section">
        <div className="section-header">
          <span className="section-eyebrow">What it does</span>
          <h2 className="section-title">Everything you need to train better</h2>
          <p className="section-desc">
            No expensive equipment, no subscriptions, no data sent to the cloud.
          </p>
        </div>

        <div className="features-grid">
          {FEATURES.map(({ icon: Icon, iconClass, title, desc }) => (
            <div className="feature-card" key={title}>
              <div className={`feature-icon ${iconClass}`}>
                <Icon size={18} />
              </div>
              <h3 className="feature-title">{title}</h3>
              <p className="feature-desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="landing-divider" />

      {/* EXERCISES */}
      <section className="exercises-preview-section">
        <div className="section-header" style={{ textAlign: "left", marginBottom: "var(--space-6)" }}>
          <span className="section-eyebrow">Supported exercises</span>
          <h2 className="section-title" style={{ fontSize: "1.4rem" }}>9 movements, tracked with precision</h2>
        </div>

        <div className="exercises-grid">
          {EXERCISES.map((ex) => (
            <button
              key={ex.id}
              className="exercise-pill"
              onClick={() => { onSelectExercise(ex.id); onLaunchLive(); }}
            >
              <div className="exercise-pill-icon">
                <Dumbbell size={14} />
              </div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div className="exercise-pill-name">{ex.name}</div>
                <div className="exercise-pill-target">{ex.target}</div>
              </div>
              <ArrowRight size={13} style={{ color: "var(--t-muted)", flexShrink: 0 }} />
            </button>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: "var(--space-6)" }}>
          <button className="btn btn-secondary" onClick={onNavigateToExercises}>
            View all exercise details <ArrowRight size={14} />
          </button>
        </div>
      </section>

      <div className="landing-divider" />

      {/* CTA */}
      <section className="cta-section">
        <h2 style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--t-primary)", marginBottom: "var(--space-3)" }}>
          Ready to analyze your workout?
        </h2>
        <p style={{ marginBottom: "var(--space-6)", color: "var(--t-secondary)" }}>
          Open your camera and start your first tracked set in seconds.
        </p>
        <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary btn-lg" onClick={onLaunchLive}>
            <Camera size={15} /> Start Now
          </button>
          <button className="btn btn-secondary btn-lg" onClick={onLaunchSimulation}>
            <Sparkles size={15} /> Watch Demo
          </button>
        </div>
      </section>

      <div style={{ height: "var(--space-10)" }} />
    </div>
  );
}
