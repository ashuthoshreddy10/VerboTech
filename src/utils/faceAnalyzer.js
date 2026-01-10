import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera } from "@mediapipe/camera_utils";

/**
 * Starts face analysis and reports behavioral metrics
 * - eyeContactRatio
 * - headMovementRatio
 */
export function startFaceAnalysis(videoElement, onMetrics) {
  let totalFrames = 0;
  let eyeContactFrames = 0;
  let headMovementFrames = 0;

  const faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMesh.onResults((results) => {
    totalFrames++;

    if (results.multiFaceLandmarks?.length) {
      const landmarks = results.multiFaceLandmarks[0];

      // Eye openness proxy (eye contact approximation)
      const leftEyeOpen = Math.abs(
        landmarks[159].y - landmarks[145].y
      );
      const rightEyeOpen = Math.abs(
        landmarks[386].y - landmarks[374].y
      );

      if (leftEyeOpen > 0.01 && rightEyeOpen > 0.01) {
        eyeContactFrames++;
      }

      // Head movement proxy (nose deviation)
      const noseX = landmarks[1].x;
      if (noseX < 0.45 || noseX > 0.55) {
        headMovementFrames++;
      }
    }

    onMetrics({
      eyeContactRatio:
        eyeContactFrames / (totalFrames || 1),
      headMovementRatio:
        headMovementFrames / (totalFrames || 1),
    });
  });

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      await faceMesh.send({ image: videoElement });
    },
    width: 640,
    height: 480,
  });

  camera.start();

  return () => {
    camera.stop();
  };
}
