import base64
import json
import sys
from datetime import datetime, timezone
from io import BytesIO

from PIL import Image
from ultralytics import YOLO


def main():
    """Watches camera snapshots and reports what it sees.

    This worker sits beside the main app, quietly waiting for pictures from
    the cameras. Each picture that arrives is scanned for things like people
    and vehicles, and the findings are sent back. As long as the same camera
    keeps feeding it pictures, it remembers who is who, so a person walking
    through successive frames keeps the same identity. When the view switches
    to a different camera, it starts fresh rather than carrying identities
    across. If a picture can't be read, it simply reports the problem instead
    of stopping.
    """
    model_path = sys.argv[1]
    model = YOLO(model_path)
    active_camera = None
    for line in sys.stdin:
        request = json.loads(line)
        request_id = request.get("requestId")
        try:
            image_bytes = base64.b64decode(request["image"], validate=True)
            image = Image.open(BytesIO(image_bytes)).convert("RGB")
            if active_camera != request.get("cameraId"):
                model.predictor = None
                active_camera = request.get("cameraId")
            result = model.track(image, persist=True, verbose=False)[0]
            detections = extract_detections(result)
            response = {"requestId": request_id, "model": str(model_path), "detections": detections}
        except Exception as error:
            response = {"requestId": request_id, "error": str(error)[:300]}
        print(json.dumps(response), flush=True)


def extract_detections(result):
    """Turns one scanned picture into a simple list of what was spotted.

    For every object the scanner found in a picture, this describes it in
    everyday terms: what it is (a person, a car, etc.), how sure the scanner
    is, where it appears in the picture as a share of the frame rather than
    raw pixels, and the moment it was noticed. Objects the scanner couldn't
    match to a continuing subject still appear, just without an identity.
    The result is a tidy summary the rest of the app can understand without
    knowing anything about how the scanning works.
    """
    width, height = result.orig_shape[1], result.orig_shape[0]
    names = result.names
    detections = []

    for index, box in enumerate(result.boxes):
        captured_at = datetime.now(timezone.utc).isoformat()
        x1, y1, x2, y2 = [float(value) for value in box.xyxy[0].tolist()]
        track_id = None
        if box.id is not None:
            track_id = str(int(box.id[0]))
        detections.append(
            {
                "id": f"det_{captured_at}_{index}",
                "trackId": track_id,
                "label": str(names[int(box.cls[0])]).lower(),
                "confidence": float(box.conf[0]),
                "box": {
                    "x": max(0.0, min(1.0, x1 / width)),
                    "y": max(0.0, min(1.0, y1 / height)),
                    "w": max(0.0, min(1.0, (x2 - x1) / width)),
                    "h": max(0.0, min(1.0, (y2 - y1) / height)),
                },
                "timestamp": captured_at,
            }
        )

    return detections


if __name__ == "__main__":
    main()
