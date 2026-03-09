"""
Subject/face tracker — determines optimal crop position for a clip.

Strategy:
  1. Sample one frame per second in the clip window
  2. Detect faces using OpenCV Haar cascade (no heavy ML deps)
  3. For wider-than-target sources: track horizontal (X) face center
     For taller-than-target sources: track vertical (Y) face center
  4. Falls back to frame center if no faces detected
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
    Calculate FFmpeg crop parameters to produce output at (out_w × out_h),
    centering on the detected subject face.

    Returns dict:
      crop_w, crop_h, crop_x, crop_y  — FFmpeg crop filter values
      out_w, out_h                     — output resolution after scale
    """
    if src_width <= 0 or src_height <= 0:
        src_width, src_height = 1920, 1080

    target_aspect = out_w / out_h
    src_aspect = src_width / src_height

    if src_aspect > target_aspect:
        # Source is wider than target — crop width, keep full height, track X
        crop_h = src_height
        crop_w = int(crop_h * target_aspect)
        crop_w = min(crop_w, src_width)
        crop_y = 0
        center_x = _detect_face_center_x(video_path, start_time, end_time, src_width, src_height)
        crop_x = max(0, min(center_x - crop_w // 2, src_width - crop_w))
    else:
        # Source is taller than target — crop height, keep full width, track Y
        crop_w = src_width
        crop_h = int(crop_w / target_aspect)
        crop_h = min(crop_h, src_height)
        crop_x = 0
        center_y = _detect_face_center_y(video_path, start_time, end_time, src_width, src_height)
        crop_y = max(0, min(center_y - crop_h // 2, src_height - crop_h))

    return {
        "crop_w": crop_w,
        "crop_h": crop_h,
        "crop_x": crop_x,
        "crop_y": crop_y,
        "out_w": out_w,
        "out_h": out_h,
    }


def _sample_faces(video_path: str, start_time: float, end_time: float):
    """
    Sample frames at 1fps and return list of (face_cx, face_cy) for each detected face.
    Returns empty list on any error.
    """
    results = []
    try:
        import cv2
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        start_frame = int(start_time * fps)
        end_frame = int(end_time * fps)
        sample_every = max(1, int(fps))

        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        detector = cv2.CascadeClassifier(cascade_path)

        for frame_num in range(start_frame, end_frame, sample_every):
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
            ret, frame = cap.read()
            if not ret:
                break
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
            if len(faces) > 0:
                largest = max(faces, key=lambda r: r[2] * r[3])
                x, y, w, h = largest
                results.append((int(x + w // 2), int(y + h // 2)))

        cap.release()
    except Exception as e:
        print(f"[tracker] Face sampling failed: {e}")
    return results


def _detect_face_center_x(video_path: str, start_time: float, end_time: float,
                           src_width: int, src_height: int) -> int:
    """Return median face center X, falls back to frame center."""
    faces = _sample_faces(video_path, start_time, end_time)
    if faces:
        return int(np.median([cx for cx, _ in faces]))
    return src_width // 2


def _detect_face_center_y(video_path: str, start_time: float, end_time: float,
                           src_width: int, src_height: int) -> int:
    """Return median face center Y, falls back to upper-third (faces are usually in top half)."""
    faces = _sample_faces(video_path, start_time, end_time)
    if faces:
        return int(np.median([cy for _, cy in faces]))
    return src_height // 3  # upper-third bias when no face detected
