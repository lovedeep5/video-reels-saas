from datetime import datetime, timezone
from sqlalchemy import (
    create_engine, Column, Integer, String, Float,
    DateTime, Boolean, ForeignKey, Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship, sessionmaker
from config import settings


engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ── ORM Models ────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    clerk_id = Column(String, unique=True, index=True, nullable=True)  # Clerk user ID
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    plan = Column(String, default="free", nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Payment fields — provisioned for Razorpay (or any provider)
    payment_customer_id = Column(String, nullable=True)       # razorpay customer id
    payment_subscription_id = Column(String, nullable=True)   # razorpay subscription id
    subscription_expires_at = Column(DateTime, nullable=True)
    payment_provider = Column(String, nullable=True)          # "razorpay" etc.

    jobs = relationship("Job", back_populates="user", cascade="all, delete-orphan")
    api_keys = relationship("ApiKey", back_populates="user", cascade="all, delete-orphan")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Status lifecycle: pending → downloading → transcribing → processing → rendering → done | failed
    status = Column(String, default="pending", nullable=False)
    progress = Column(Integer, default=0)            # 0-100
    progress_message = Column(String, default="Queued")

    source_type = Column(String, nullable=False)     # "url" | "upload"
    source_url = Column(String, nullable=True)
    source_filename = Column(String, nullable=True)
    source_path = Column(String, nullable=True)      # local path to downloaded/uploaded file

    video_title = Column(String, nullable=True)
    video_duration = Column(Float, nullable=True)    # seconds

    clips_requested = Column(Integer, default=5)
    output_ratio = Column(String, default="9:16", nullable=False)  # e.g. "9:16", "1:1", "16:9"
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="jobs")
    clips = relationship("Clip", back_populates="job", cascade="all, delete-orphan")


class Clip(Base):
    __tablename__ = "clips"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)

    clip_index = Column(Integer, nullable=False)
    start_time = Column(Float, nullable=False)       # seconds in source video
    end_time = Column(Float, nullable=False)
    duration = Column(Float, nullable=False)
    importance_score = Column(Float, default=0.0)
    file_path = Column(String, nullable=True)        # local path to rendered clip (deleted after S3 upload)
    file_size = Column(Integer, nullable=True)       # bytes
    s3_key = Column(String, nullable=True)           # S3 object key, set after successful upload
    transcript_excerpt = Column(Text, nullable=True) # first ~150 chars of transcript

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    job = relationship("Job", back_populates="clips")


# ── API Keys ──────────────────────────────────────────────────────────────────
class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)              # user-given label
    key_prefix = Column(String, nullable=False)        # first 16 chars for display
    key_hash = Column(String, nullable=False, unique=True)  # SHA-256 of full key
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_used_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)       # None = never expires

    user = relationship("User", back_populates="api_keys")


# ── Payment event log — ready for Razorpay webhooks ──────────────────────────
class PaymentEvent(Base):
    __tablename__ = "payment_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    provider = Column(String, nullable=False)        # "razorpay"
    event_type = Column(String, nullable=False)      # "subscription.activated" etc.
    payload = Column(Text, nullable=True)            # raw JSON payload
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
