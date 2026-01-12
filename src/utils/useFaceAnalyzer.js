import { useEffect, useRef, useState } from "react";

export function useFaceAnalyzer(enabled) {
  const videoRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);

  // 🔒 Last emitted values (prevents infinite React updates)
  const lastMetricsRef = useRef({
    eyeContact: null,
    expressiveness: null,
  });

  const [faceMetrics, setFaceMetrics] = useState({
    eyeContact: null,
    expressiveness: null,
  });

  useEffect(() => {
    if (!enabled) {
      lastMetricsRef.current = {
        eyeContact: null,
        expressiveness: null,
      };
      setFaceMetrics({
        eyeContact: null,
        expressiveness: null,
      });
      return;
    }

    let stream;
    let cancelled = false;

    async function init() {
      try {
        // ⛔ Wait until <video> exists
        if (!videoRef.current) {
          setTimeout(init, 100);
          return;
        }

        const video = videoRef.current;

        // 🎥 Camera
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;

        try {
          await video.play();
        } catch {
          // Ignore play interruption (browser race condition)
        }

        // Lazy-load MediaPipe
        const vision = await import("@mediapipe/tasks-vision");
        const { FilesetResolver, FaceLandmarker } = vision;

        const resolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );

        landmarkerRef.current =
          await FaceLandmarker.createFromOptions(resolver, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-assets/face_landmarker.task",
            },
            runningMode: "VIDEO",
            numFaces: 1,
          });

        const analyze = () => {
          if (cancelled || !landmarkerRef.current) return;

          try {
            const now = performance.now();
            const result =
              landmarkerRef.current.detectForVideo(video, now);

            if (result.faceLandmarks?.length) {
              const lm = result.faceLandmarks[0];

              if (lm[1] && lm[13] && lm[14]) {
                const noseX = lm[1].x;
                const eyeContact =
                  noseX > 0.45 && noseX < 0.55 ? "Good" : "Low";

                const mouthOpen = Math.abs(lm[13].y - lm[14].y);
                const expressiveness =
                  mouthOpen > 0.02 ? "Expressive" : "Flat";

                const last = lastMetricsRef.current;

                // 🔒 Update React state ONLY if values changed
                if (
                  last.eyeContact !== eyeContact ||
                  last.expressiveness !== expressiveness
                ) {
                  lastMetricsRef.current = {
                    eyeContact,
                    expressiveness,
                  };
                  setFaceMetrics({ eyeContact, expressiveness });
                }
              }
            }
          } catch {
            // swallow occasional MediaPipe frame errors
          }

          rafRef.current = requestAnimationFrame(analyze);
        };

        analyze();
      } catch (e) {
        console.error("Face analyzer failed:", e);
      }
    }

    init();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [enabled]);

  return {
    ...faceMetrics,
    videoRef,
  };
}
