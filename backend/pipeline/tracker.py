"""
Subject/face tracker — determines optimal crop strategy for a clip.

Strategy:
  1. Sample 2 frames/sec in the clip window
  2. Detect all faces using OpenCV Haar cascade
  3. Classify layout:
       single speaker  → smooth per-second tracking with exponential smoothing
       dual speakers   → split-screen: crop each face, vstack vertically
  4. Falls back to frame center if no faces detected
"""
import numpy as np

SAMPLE_FPS = 2          # frames per second to sample for face detection
SMOOTH_ALPHA = 0.35     # EMA smoothing (lower = smoother, slower to react)
DUAL_GAP_RATIO = 0.15   # minimum gap between speakers (fraction of frame width)
DUAL_MIN_RATIO = 0.20   # each speaker must account for at least 20% of samples


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
    Analyse the clip and return crop parameters.

    Returned dict always contains:
      layout    "single" | "dual"
      out_w, out_h

    "single" also contains:
      crop_w, crop_h, crop_x, crop_y   static fallback position
      crop_x_expr                       ffmpeg expression for smooth tracking
                                        (None if source is already portrait)

    "dual" also contains:
      crop_w, crop_h                    per-half crop dimensions
      crop_x_a, crop_x_b               left / right speaker crop_x
      crop_y                            always 0 for landscape sources
    """
    if src_width <= 0 or src_height <= 0:
        src_width, src_height = 1920, 1080

    target_aspect = out_w / out_h
    src_aspect    = src_width / src_height

    face_data = _sample_faces(video_path, start_time, end_time, src_width, src_height)

    # ── Landscape source → need to crop width, track horizontally ─────────────
    if src_aspect > target_aspect:
        crop_h = src_height
        crop_w = min(int(crop_h * target_aspect), src_width)
        crop_y = 0

        layout, group_a, group_b = _classify_layout(face_data, src_width)

        if layout == "dual":
            # Each half of the output is out_w × (out_h // 2)
            half_h     = out_h // 2
            half_crop_w = min(int(src_height * out_w / half_h), src_width)

            face_ax = int(np.median([x for x, y in group_a]))
            face_bx = int(np.median([x for x, y in group_b]))

            crop_x_a = _clamp(face_ax - half_crop_w // 2, 0, src_width - half_crop_w)
            crop_x_b = _clamp(face_bx - half_crop_w // 2, 0, src_width - half_crop_w)

            print(f"[tracker] dual layout — speaker A x={face_ax}, speaker B x={face_bx}")
            return {
                "layout":    "dual",
                "crop_h":    crop_h,
                "crop_w":    half_crop_w,
                "crop_y":    0,
                "crop_x_a":  crop_x_a,
                "crop_x_b":  crop_x_b,
                "out_w":     out_w,
                "out_h":     out_h,
            }

        # Single speaker — build smooth tracking expression
        timeline = _build_x_timeline(face_data, start_time, end_time, src_width, crop_w)
        crop_x_expr = _build_crop_expr(timeline)

        # Static fallback (median across all samples)
        if face_data:
            cx = int(np.median([x for x, y, _ in face_data]))
        else:
            cx = src_width // 2
        crop_x_static = _clamp(cx - crop_w // 2, 0, src_width - crop_w)

        return {
            "layout":      "single",
            "crop_w":      crop_w,
            "crop_h":      crop_h,
            "crop_x":      crop_x_static,
            "crop_y":      crop_y,
            "crop_x_expr": crop_x_expr,
            "out_w":       out_w,
            "out_h":       out_h,
        }

    # ── Portrait / square source → crop height, track vertically ──────────────
    crop_w = src_width
    crop_h = min(int(crop_w / target_aspect), src_height)
    crop_x = 0

    if face_data:
        cy = int(np.median([y for _, y, _ in face_data]))
    else:
        cy = src_height // 3  # upper-third bias when no face found

    crop_y = _clamp(cy - crop_h // 2, 0, src_height - crop_h)

    return {
        "layout":      "single",
        "crop_w":      crop_w,
        "crop_h":      crop_h,
        "crop_x":      crop_x,
        "crop_y":      crop_y,
        "crop_x_expr": None,   # no horizontal tracking needed
        "out_w":       out_w,
        "out_h":       out_h,
    }


# ── Internal helpers ──────────────────────────────────────────────────────────

def _clamp(val, lo, hi):
    return max(lo, min(val, hi))


def _sample_faces(video_path, start_time, end_time, src_width, src_height):
    """
    Sample at SAMPLE_FPS, detect all faces.
    Returns list of (center_x, center_y, timestamp_within_clip).
    """
    results = []
    try:
        import cv2

        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        start_frame  = int(start_time * fps)
        end_frame    = int(end_time   * fps)
        sample_every = max(1, int(fps / SAMPLE_FPS))

        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        detector = cv2.CascadeClassifier(cascade_path)

        # Downscale factor — detect on 640px-wide frame for speed
        scale = min(1.0, 640.0 / max(src_width, 1))

        for frame_num in range(start_frame, end_frame, sample_every):
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
            ret, frame = cap.read()
            if not ret:
                break

            if scale < 1.0:
                small = cv2.resize(frame, (int(src_width * scale), int(src_height * scale)))
            else:
                small = frame

            gray  = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
            faces = detector.detectMultiScale(
                gray, scaleFactor=1.1, minNeighbors=4, minSize=(25, 25)
            )

            t = (frame_num - start_frame) / fps
            for x, y, w, h in faces:
                cx = int((x + w / 2) / scale)
                cy = int((y + h / 2) / scale)
                results.append((cx, cy, t))

        cap.release()
        print(f"[tracker] sampled {len(results)} face detections over {end_time - start_time:.1f}s")

    except Exception as e:
        print(f"[tracker] face sampling failed: {e}")

    return results


def _classify_layout(face_data, src_width):
    """
    Decide single vs dual speaker layout.
    Returns ("single"|"dual", group_a [(x,y)], group_b [(x,y)]).
    """
    if len(face_data) < 6:
        return "single", [(x, y) for x, y, _ in face_data], []

    xs = sorted(x for x, y, _ in face_data)

    # Find the largest gap between adjacent x-values
    gaps = [(xs[i + 1] - xs[i], i) for i in range(len(xs) - 1)]
    max_gap, split_idx = max(gaps, key=lambda g: g[0])

    # Gap must be significant
    if max_gap < src_width * DUAL_GAP_RATIO:
        return "single", [(x, y) for x, y, _ in face_data], []

    split_x = (xs[split_idx] + xs[split_idx + 1]) / 2
    group_a  = [(x, y) for x, y, _ in face_data if x <= split_x]
    group_b  = [(x, y) for x, y, _ in face_data if x  > split_x]

    # Both groups must be substantial
    ratio = min(len(group_a), len(group_b)) / len(face_data)
    if ratio < DUAL_MIN_RATIO:
        return "single", [(x, y) for x, y, _ in face_data], []

    print(f"[tracker] dual speaker gap={max_gap}px at x={split_x:.0f} — A={len(group_a)} B={len(group_b)} samples")
    return "dual", group_a, group_b


def _build_x_timeline(face_data, start_time, end_time, src_width, crop_w):
    """
    Build a smoothed crop_x value for each whole second of the clip.
    Returns list of integers (one per second, 0-indexed from clip start).
    """
    duration   = end_time - start_time
    n_seconds  = max(1, int(np.ceil(duration)))
    fallback_x = _clamp(src_width // 2 - crop_w // 2, 0, src_width - crop_w)

    # Group detections by second
    by_second = {}
    for x, y, t in face_data:
        s = int(t)
        by_second.setdefault(s, []).append(x)

    # Raw position per second
    raw = []
    for s in range(n_seconds + 1):
        if s in by_second:
            cx = int(np.median(by_second[s]))
        elif by_second:
            # nearest second with data
            cx = int(np.median(by_second[min(by_second, key=lambda k: abs(k - s))]))
        else:
            cx = src_width // 2
        raw.append(_clamp(cx - crop_w // 2, 0, src_width - crop_w))

    # Exponential moving average for smooth camera movement
    smoothed = [raw[0]]
    for v in raw[1:]:
        smoothed.append(int(SMOOTH_ALPHA * v + (1 - SMOOTH_ALPHA) * smoothed[-1]))

    return smoothed


def _build_crop_expr(timeline):
    """
    Build an ffmpeg crop x-expression that steps through positions each second.
    Uses step function (position changes each whole second).
    Example for 3 seconds: if(lt(t,1),x0,if(lt(t,2),x1,x2))
    """
    if not timeline:
        return None
    if len(timeline) == 1:
        return str(timeline[0])

    # Build nested if() from right to left
    expr = str(timeline[-1])
    for i in range(len(timeline) - 2, -1, -1):
        expr = f"if(lt(t,{i + 1}),{timeline[i]},{expr})"
    return expr
