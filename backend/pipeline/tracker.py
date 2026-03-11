"""
Subject/face tracker — determines optimal crop position for a clip.

Scenarios detected:
  no_face       — < 25% of sampled frames have a face → center crop fallback
  single_speaker — > 75% of face-frames have exactly 1 face → smooth per-segment tracking
  dual_speaker  — > 50% of face-frames have 2 faces with wide horizontal gap → vstack both
  group         — everything else (3+ faces, mixed, close together) → encompassing bbox crop

Rendering contract:
  Returns a dict always containing crop_w/h/x/y/out_w/out_h (backward compat with run_job.py).
  Additional optional keys: scenario, tracking_segments, dual_faces.
  processor.py reads these to dispatch the right ffmpeg strategy.
"""
import numpy as np


def get_crop_params(
    video_path: str,
    start_time: float,
    end_time: float,
    src_width: int,
    src_height: int,
    out_w: int = 1080,
    out_h: int = 1920,
) -> dict:
    """
    Calculate FFmpeg crop parameters to produce output at (out_w × out_h).
    Detects scenario (no_face / single_speaker / dual_speaker / group) and
    returns appropriate crop strategy in the result dict.

    Always returns at minimum:
      crop_w, crop_h, crop_x, crop_y, out_w, out_h  (backward compat)
    Plus optional new keys:
      scenario, tracking_segments, dual_faces
    """
    if src_width <= 0 or src_height <= 0:
        src_width, src_height = 1920, 1080

    target_aspect = out_w / out_h
    src_aspect = src_width / src_height

    # Base crop dimensions (same logic as before)
    if src_aspect > target_aspect:
        # Wider source → crop width, keep full height
        crop_h = src_height
        crop_w = min(int(crop_h * target_aspect), src_width)
        crop_y = 0
    else:
        # Taller source → crop height, keep full width
        crop_w = src_width
        crop_h = min(int(crop_w / target_aspect), src_height)
        crop_y = 0

    # Sample all faces per second across the clip
    per_frame_data = _sample_frames_all_faces(video_path, start_time, end_time)
    scenario = _detect_scenario(per_frame_data, src_width)

    print(f"[tracker] scenario={scenario} frames_sampled={len(per_frame_data)} "
          f"frames_with_faces={sum(1 for f in per_frame_data if f)}")

    # ── no_face: fall back to center / upper-third ────────────────────────────
    if scenario == "no_face":
        if src_aspect > target_aspect:
            crop_x = (src_width - crop_w) // 2
        else:
            crop_y = max(0, min(src_height // 3 - crop_h // 2, src_height - crop_h))
            crop_x = 0
        return _base_dict(crop_w, crop_h, crop_x, crop_y, out_w, out_h, scenario)

    # ── dual_speaker: vstack left + right crops ───────────────────────────────
    if scenario == "dual_speaker":
        dual = _build_dual_crops(per_frame_data, crop_w, crop_h, src_width, src_height)
        if dual:
            # static crop_x = midpoint between both speakers (fallback for renderers
            # that don't understand dual_faces key)
            crop_x = max(0, min((dual["left"]["crop_x"] + dual["right"]["crop_x"]) // 2,
                                src_width - crop_w))
            result = _base_dict(crop_w, crop_h, crop_x, crop_y, out_w, out_h, scenario)
            result["dual_faces"] = dual
            return result
        # Couldn't build dual crops → fall through to single_speaker logic
        scenario = "single_speaker"

    # ── group: crop to encompass all detected faces ────────────────────────────
    if scenario == "group":
        crop_x, crop_y_group = _build_group_crop(
            per_frame_data, crop_w, crop_h, src_width, src_height
        )
        if src_aspect <= target_aspect:
            crop_y = crop_y_group
        return _base_dict(crop_w, crop_h, crop_x, crop_y, out_w, out_h, scenario)

    # ── single_speaker: per-segment smooth tracking ───────────────────────────
    segments = _build_tracking_segments(per_frame_data, crop_w, crop_h, src_width, src_height)
    if segments:
        # Fallback static crop_x = median of all segment positions
        all_x = [s["crop_x"] for s in segments]
        crop_x = int(np.median(all_x))
        result = _base_dict(crop_w, crop_h, crop_x, crop_y, out_w, out_h, scenario)
        result["tracking_segments"] = segments
        return result

    # Couldn't build segments → static median crop
    face_xs = [faces[0][0] for faces in per_frame_data if faces]
    center_x = int(np.median(face_xs)) if face_xs else src_width // 2
    crop_x = max(0, min(center_x - crop_w // 2, src_width - crop_w))
    return _base_dict(crop_w, crop_h, crop_x, crop_y, out_w, out_h, scenario)


# ── Internal helpers ──────────────────────────────────────────────────────────

def _base_dict(crop_w, crop_h, crop_x, crop_y, out_w, out_h, scenario):
    return {
        "crop_w": crop_w, "crop_h": crop_h,
        "crop_x": crop_x, "crop_y": crop_y,
        "out_w":  out_w,  "out_h":  out_h,
        "scenario": scenario,
        "tracking_segments": None,
        "dual_faces": None,
    }


def _sample_frames_all_faces(video_path: str, start_time: float, end_time: float) -> list:
    """
    Sample at 1fps. Returns list of per-second face lists.
    Each entry is a list of (cx, cy, w, h) for every face detected that second.
    Empty list for seconds with no face detected.
    """
    per_frame = []
    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        sample_every = max(1, int(fps))

        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        detector = cv2.CascadeClassifier(cascade_path)

        # Scale minSize to video resolution so detection works on 360p to 1080p
        frame_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 640
        min_face = max(20, int(frame_w * 0.04))

        # Seek once to start_time, then read sequentially — much faster than
        # seeking to each individual frame (avoids re-scan on every seek)
        cap.set(cv2.CAP_PROP_POS_MSEC, start_time * 1000)
        end_msec = end_time * 1000
        frame_counter = 0

        while True:
            pos_msec = cap.get(cv2.CAP_PROP_POS_MSEC)
            if pos_msec >= end_msec:
                break
            ret, frame = cap.read()
            if not ret:
                break

            # Process every ~1 second (skip frames between samples)
            if frame_counter % sample_every == 0:
                gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = detector.detectMultiScale(
                    gray, scaleFactor=1.1, minNeighbors=5, minSize=(min_face, min_face)
                )
                if len(faces) == 0:
                    per_frame.append([])
                else:
                    per_frame.append([
                        (int(x + w // 2), int(y + h // 2), int(w), int(h))
                        for x, y, w, h in faces
                    ])
            frame_counter += 1

        cap.release()
    except Exception as e:
        print(f"[tracker] Face sampling failed: {e}")
    return per_frame


def _detect_scenario(per_frame_data: list, src_width: int) -> str:
    """
    Classify the clip based on per-frame face data.

    Priority order: no_face → dual_speaker → single_speaker → group
    """
    total = len(per_frame_data)
    if total == 0:
        return "no_face"

    frames_with_faces = [f for f in per_frame_data if f]
    face_ratio = len(frames_with_faces) / total

    # no_face: fewer than 1-in-4 frames have a face
    if face_ratio < 0.25:
        return "no_face"

    # Count how often we see exactly 1 or 2 faces
    count_one = sum(1 for f in frames_with_faces if len(f) == 1)
    count_two = sum(1 for f in frames_with_faces if len(f) == 2)
    n = len(frames_with_faces)

    # dual_speaker: majority of face-frames have 2 horizontally-separated faces
    if count_two / n > 0.50:
        # Verify horizontal separation on the two-face frames
        sep_count = 0
        for faces in frames_with_faces:
            if len(faces) == 2:
                cx_a, cx_b = faces[0][0], faces[1][0]
                if abs(cx_a - cx_b) > 0.20 * src_width:
                    sep_count += 1
        if sep_count / max(count_two, 1) > 0.50:
            return "dual_speaker"

    # single_speaker: majority of face-frames have exactly 1 face that is large enough
    if count_one / n > 0.75:
        # Face width should be at least 8% of src_width to be a close-up speaker
        large_count = sum(
            1 for f in frames_with_faces if len(f) == 1 and f[0][2] >= 0.08 * src_width
        )
        if large_count / max(count_one, 1) > 0.50:
            return "single_speaker"

    return "group"


def _build_tracking_segments(
    per_frame_data: list,
    crop_w: int,
    crop_h: int,
    src_width: int,
    src_height: int,
) -> list:
    """
    Build a list of time segments, each with a static crop_x position.
    Consecutive seconds with similar crop_x (diff < 30px) are merged.

    Returns [{start_sec, end_sec, crop_x, crop_y}, ...] (times relative to clip start = 0).
    Returns empty list if tracking data is insufficient.
    """
    if not per_frame_data:
        return []

    # Extract per-second dominant face center_x
    raw_cx = []
    for faces in per_frame_data:
        if faces:
            # Pick the largest face
            largest = max(faces, key=lambda f: f[2] * f[3])
            raw_cx.append(largest[0])
        else:
            raw_cx.append(None)

    # Fill None gaps by linear interpolation from neighbours
    cx_filled = _interpolate_gaps(raw_cx, fallback=src_width // 2)

    # Convert center_x → crop_x (clamped)
    crop_xs = [
        max(0, min(cx - crop_w // 2, src_width - crop_w))
        for cx in cx_filled
    ]

    # Smooth with 5-second boxcar to absorb detection noise
    kernel = np.ones(5) / 5.0
    smoothed = np.convolve(crop_xs, kernel, mode="same").astype(int).tolist()

    # y position: constant center (landscape) or 0 (portrait — full height kept)
    crop_y = 0

    # Group consecutive seconds where crop_x changes less than 8% of crop_w
    # (scales with resolution: ~16px for 202px crop, ~49px for 607px crop)
    MERGE_THRESHOLD = max(20, int(crop_w * 0.08))
    segments = []
    seg_start = 0
    seg_x = smoothed[0]

    for i in range(1, len(smoothed)):
        if abs(smoothed[i] - seg_x) >= MERGE_THRESHOLD:
            segments.append({
                "start_sec": float(seg_start),
                "end_sec":   float(i),
                "crop_x":    int(seg_x),
                "crop_y":    crop_y,
            })
            seg_start = i
            seg_x = smoothed[i]

    # Final segment
    segments.append({
        "start_sec": float(seg_start),
        "end_sec":   float(len(smoothed)),
        "crop_x":    int(seg_x),
        "crop_y":    crop_y,
    })

    # Cap at 20 segments to keep filter_complex manageable
    if len(segments) > 20:
        print(f"[tracker] {len(segments)} segments > 20, falling back to static crop")
        return []

    return segments


def _build_dual_crops(
    per_frame_data: list,
    crop_w: int,
    crop_h: int,
    src_width: int,
    src_height: int,
) -> dict | None:
    """
    For dual_speaker: compute median crop positions for the left and right speaker.
    Returns {"left": {crop_x, crop_y, crop_w, crop_h}, "right": {...}} or None on failure.
    """
    left_xs, right_xs = [], []
    for faces in per_frame_data:
        if len(faces) == 2:
            cx_a, cx_b = faces[0][0], faces[1][0]
            left_cx  = min(cx_a, cx_b)
            right_cx = max(cx_a, cx_b)
            left_xs.append(left_cx)
            right_xs.append(right_cx)

    if not left_xs:
        return None

    left_center  = int(np.median(left_xs))
    right_center = int(np.median(right_xs))

    # Each half of the vstack output gets out_h//2 height, so crop must match
    # that aspect. We keep crop_w and crop_h the same as the single-speaker
    # crop (renderer will scale each half to out_w x out_h//2).
    left_x  = max(0, min(left_center  - crop_w // 2, src_width - crop_w))
    right_x = max(0, min(right_center - crop_w // 2, src_width - crop_w))

    if left_x == right_x:
        return None  # degenerate — both speakers mapped to same position

    return {
        "left":  {"crop_x": left_x,  "crop_y": 0, "crop_w": crop_w, "crop_h": crop_h},
        "right": {"crop_x": right_x, "crop_y": 0, "crop_w": crop_w, "crop_h": crop_h},
    }


def _build_group_crop(
    per_frame_data: list,
    crop_w: int,
    crop_h: int,
    src_width: int,
    src_height: int,
) -> tuple:
    """
    Compute a crop that encompasses all detected faces with 20% padding.
    Returns (crop_x, crop_y).
    """
    all_faces = [f for frame in per_frame_data for f in frame]
    if not all_faces:
        return (src_width - crop_w) // 2, (src_height - crop_h) // 2

    # Bounding box of all face centers
    min_cx = min(f[0] for f in all_faces)
    max_cx = max(f[0] for f in all_faces)
    min_cy = min(f[1] for f in all_faces)
    max_cy = max(f[1] for f in all_faces)

    center_x = (min_cx + max_cx) // 2
    center_y = (min_cy + max_cy) // 2

    crop_x = max(0, min(center_x - crop_w // 2, src_width  - crop_w))
    crop_y = max(0, min(center_y - crop_h // 2, src_height - crop_h))
    return crop_x, crop_y


def _interpolate_gaps(values: list, fallback: int) -> list:
    """
    Fill None entries in values list via linear interpolation.
    Leading/trailing Nones get the nearest valid value (or fallback).
    """
    result = list(values)
    n = len(result)

    # Forward fill leading Nones
    first_valid = next((i for i, v in enumerate(result) if v is not None), None)
    if first_valid is None:
        return [fallback] * n
    for i in range(first_valid):
        result[i] = result[first_valid]

    # Back fill trailing Nones
    last_valid = next((i for i in range(n - 1, -1, -1) if result[i] is not None), None)
    for i in range(last_valid + 1, n):
        result[i] = result[last_valid]

    # Linear interpolate interior gaps
    i = 0
    while i < n:
        if result[i] is None:
            # Find next valid value
            j = i + 1
            while j < n and result[j] is None:
                j += 1
            start_val = result[i - 1]
            end_val   = result[j] if j < n else result[i - 1]
            gap_len   = j - (i - 1)
            for k in range(i, j):
                t = (k - (i - 1)) / gap_len
                result[k] = int(start_val + t * (end_val - start_val))
            i = j
        else:
            i += 1

    return result


# ── Legacy helpers (kept for any direct callers) ──────────────────────────────

def _sample_faces(video_path: str, start_time: float, end_time: float):
    """Legacy: returns list of (cx, cy) for largest face per sampled frame."""
    per_frame = _sample_frames_all_faces(video_path, start_time, end_time)
    results = []
    for faces in per_frame:
        if faces:
            largest = max(faces, key=lambda f: f[2] * f[3])
            results.append((largest[0], largest[1]))
    return results


def _detect_face_center_x(video_path, start_time, end_time, src_width, src_height):
    faces = _sample_faces(video_path, start_time, end_time)
    return int(np.median([cx for cx, _ in faces])) if faces else src_width // 2


def _detect_face_center_y(video_path, start_time, end_time, src_width, src_height):
    faces = _sample_faces(video_path, start_time, end_time)
    return int(np.median([cy for _, cy in faces])) if faces else src_height // 3
