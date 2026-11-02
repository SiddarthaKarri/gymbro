import React, { useState } from "react";
import { Activity, Camera, BarChart2, BookOpen, Dumbbell, History, Sparkles, Wifi, WifiOff, Menu, X, ChevronRight } from "lucide-react";

export function Navbar({ activeTab, setActiveTab, connectionStatus, streamStats, rttMs, onLaunchSimulation, onLaunchLive }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const tabs = [
    { id: "overview",   label: "Home",      icon: Activity },
    { id: "live",       label: "Studio",    icon: Camera },
    { id: "analytics",  label: "Analytics", icon: BarChart2 },
    { id: "exercises",  label: "Exercises", icon: Dumbbell },
    { id: "history",    label: "History",   icon: History },
    { id: "research",   label: "Research",  icon: BookOpen },
  ];

  const isConnected = connectionStatus === "connected";

  return (
    <header className="app-navbar">
      {/* Logo */}
      <div className="nav-left">
        <div className="app-logo" onClick={() => { setActiveTab("overview"); setMobileOpen(false); }}>
          <div className="logo-mark">
            <Activity size={14} color="#fff" />
          </div>
          <div className="logo-text-group">
            <span className="logo-title">FormCheck</span>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="nav-tabs desktop-only">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-tab ${activeTab === id ? "tab-active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Right side */}
      <div className="nav-right">
        {/* Connection status */}
        <div className="nav-conn-row desktop-only">
          <span className={`conn-dot ${isConnected ? "online" : ""}`} />
          <span className="conn-label">{isConnected ? `${streamStats?.streamFps || 0} FPS · ${rttMs}ms` : "Offline"}</span>
        </div>

        <button className="btn-nav-action desktop-only" onClick={onLaunchSimulation}>
          <Sparkles size={13} />
          Try Demo
        </button>

        <button className="btn-nav-action btn-nav-primary desktop-only" onClick={onLaunchLive}>
          <Camera size={13} />
          Start Session
        </button>

        {/* Mobile menu button */}
        <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="mobile-nav-drawer">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`mobile-nav-item ${activeTab === id ? "active" : ""}`}
              onClick={() => { setActiveTab(id); setMobileOpen(false); }}
            >
              <Icon size={16} />
              <span>{label}</span>
              <ChevronRight size={14} style={{ marginLeft: "auto", opacity: 0.4 }} />
            </button>
          ))}
          <div className="mobile-nav-actions">
            <button className="btn-hero-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => { onLaunchSimulation(); setMobileOpen(false); }}>
              <Sparkles size={14} /> Try Demo
            </button>
            <button className="btn-hero-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => { onLaunchLive(); setMobileOpen(false); }}>
              <Camera size={14} /> Start Session
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
