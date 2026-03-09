"""
Unit tests for pipeline components (no FFmpeg or GPU required).
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import numpy as np
import pytest


# ── Transcriber ───────────────────────────────────────────────────────────────

from pipeline.transcriber import generate_srt, _srt_time


def test_srt_time_format():
    assert _srt_time(0) == "00:00:00,000"
    assert _srt_time(3661.5) == "01:01:01,500"
    assert _srt_time(90.25) == "00:01:30,250"


def test_generate_srt_basic():
    segments = [
        {"start": 0.0, "end": 3.0, "text": "Hello world"},
        {"start": 5.0, "end": 8.0, "text": "Second line"},
        {"start": 40.0, "end": 43.0, "text": "Outside clip"},
    ]
    srt = generate_srt(segments, start_offset=0.0, end_offset=35.0)
    assert "Hello world" in srt
    assert "Second line" in srt
    assert "Outside clip" not in srt


def test_generate_srt_offset():
    segments = [{"start": 60.0, "end": 63.0, "text": "At 1 minute"}]
    srt = generate_srt(segments, start_offset=60.0, end_offset=95.0)
    assert "00:00:00,000 --> 00:00:03,000" in srt
    assert "At 1 minute" in srt


def test_generate_srt_empty():
    srt = generate_srt([], 0.0, 35.0)
    assert srt.strip() == ""


# ── Scorer ────────────────────────────────────────────────────────────────────

from pipeline.scorer import select_best_clips


def test_select_clips_basic():
    segments = [
        {"start": i * 2.0, "end": i * 2.0 + 1.5, "text": "word " * 10}
        for i in range(100)
    ]
    energy = np.ones(200, dtype=np.float32)
    clips = select_best_clips(
        duration=200.0,
        segments=segments,
        energy=energy,
        n_clips=3,
        clip_duration=35.0,
    )
    assert len(clips) <= 3
    for c in clips:
        assert c["end"] - c["start"] >= 28.0
        assert "score" in c
        assert "start" in c
        assert "end" in c


def test_select_clips_short_video():
    energy = np.ones(20, dtype=np.float32)
    clips = select_best_clips(
        duration=20.0,
        segments=[{"start": 0, "end": 5, "text": "hello"}],
        energy=energy,
        n_clips=3,
    )
    assert len(clips) == 1
    assert clips[0]["start"] == 0.0
    assert clips[0]["end"] == 20.0


def test_select_clips_no_overlap():
    segments = [{"start": i, "end": i + 1, "text": "word"} for i in range(200)]
    energy = np.random.rand(200).astype(np.float32)
    clips = select_best_clips(
        duration=200.0,
        segments=segments,
        energy=energy,
        n_clips=5,
        clip_duration=35.0,
    )
    # Verify no two clips overlap by more than 25%
    for i, a in enumerate(clips):
        for j, b in enumerate(clips):
            if i >= j:
                continue
            overlap = min(a["end"], b["end"]) - max(a["start"], b["start"])
            if overlap > 0:
                assert overlap <= 35.0 * 0.25 + 0.1  # tolerance


def test_select_clips_sorted_chronologically():
    energy = np.ones(300, dtype=np.float32)
    segments = [{"start": i, "end": i + 1, "text": "word"} for i in range(300)]
    clips = select_best_clips(300.0, segments, energy, n_clips=4, clip_duration=35.0)
    starts = [c["start"] for c in clips]
    assert starts == sorted(starts)


# ── Tracker ───────────────────────────────────────────────────────────────────

from pipeline.tracker import get_crop_params


def test_crop_params_landscape():
    params = get_crop_params("nonexistent.mp4", 0, 10, src_width=1920, src_height=1080)
    assert params["crop_w"] < params["crop_h"]  # portrait crop
    assert params["out_w"] == 1080
    assert params["out_h"] == 1920
    assert 0 <= params["crop_x"] <= 1920 - params["crop_w"]
    assert params["crop_y"] == 0


def test_crop_params_portrait_source():
    params = get_crop_params("nonexistent.mp4", 0, 10, src_width=1080, src_height=1920)
    assert params["crop_w"] == 1080
    assert params["out_w"] == 1080
    assert params["out_h"] == 1920
