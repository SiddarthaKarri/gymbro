from datetime import datetime
import os
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./kinematic.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_uuid = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    exercise_type = Column(String, default="bicep_curl", nullable=False)
    total_reps = Column(Integer, default=0)
    overall_avg_quality = Column(Float, default=0.0)
    duration_seconds = Column(Float, default=0.0)
    weight_kg = Column(Float, default=0.0)

    # Relationships
    repetitions = relationship(
        "RepetitionData",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="RepetitionData.rep_number"
    )


class RepetitionData(Base):
    __tablename__ = "repetition_data"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("workout_sessions.id", ondelete="CASCADE"), nullable=False)
    rep_number = Column(Integer, nullable=False)
    peak_depth_angle = Column(Float, default=0.0)
    peak_left_elbow = Column(Float, default=0.0)
    peak_right_elbow = Column(Float, default=0.0)
    avg_symmetry_delta = Column(Float, default=0.0)
    quality_score = Column(Float, default=100.0)
    duration_ms = Column(Float, default=0.0)
    mean_velocity_mps = Column(Float, default=0.0)
    peak_velocity_mps = Column(Float, default=0.0)
    velocity_loss_pct = Column(Float, default=0.0)
    max_spine_dev = Column(Float, default=0.0)
    power_watts = Column(Float, default=0.0)
    estimated_1rm_kg = Column(Float, default=0.0)
    reps_in_reserve = Column(Integer, default=0)
    feedback_notes = Column(String, default="")

    session = relationship("WorkoutSession", back_populates="repetitions")


def init_db():
    Base.metadata.create_all(bind=engine)
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE workout_sessions ADD COLUMN weight_kg FLOAT DEFAULT 0.0"))
            conn.commit()
    except Exception:
        pass  # Column already exists


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
