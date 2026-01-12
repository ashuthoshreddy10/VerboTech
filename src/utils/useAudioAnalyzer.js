import { useEffect, useRef, useState } from "react";

export function useAudioAnalyzer() {
  const [audioMetrics, setAudioMetrics] = useState({
    isSpeaking: false,
    longPauses: 0,
    silenceCount: 0,
    everSpoke: false,
  });

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const rafIdRef = useRef(null);

  // High-frequency refs (NO React re-renders)
  const speakingFramesRef = useRef(0);
  const silentFramesRef = useRef(0);
  const longPauseCountRef = useRef(0);
  const silenceCountRef = useRef(0);
  const everSpokeRef = useRef(false);

  // 🔒 Last emitted state (prevents infinite update loops)
  const lastMetricsRef = useRef({
    isSpeaking: false,
    longPauses: 0,
    silenceCount: 0,
    everSpoke: false,
  });

  useEffect(() => {
    let stream;

    async function initMic() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        console.error("Mic permission denied", e);
        return;
      }

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.fftSize);

      const analyze = () => {
        analyser.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }

        const volume = Math.sqrt(sum / dataArray.length);
        const speakingNow = volume > 0.035;

        if (speakingNow) {
          speakingFramesRef.current++;
          silentFramesRef.current = 0;
          everSpokeRef.current = true;
        } else {
          silentFramesRef.current++;
          speakingFramesRef.current = 0;
        }

        let isSpeaking = lastMetricsRef.current.isSpeaking;

        // Speaking debounce
        if (speakingFramesRef.current > 6) {
          isSpeaking = true;
        }

        // Silence detection
        if (silentFramesRef.current > 20) {
          isSpeaking = false;
          longPauseCountRef.current++;
          silenceCountRef.current++;
        }

        const nextMetrics = {
          isSpeaking,
          longPauses: longPauseCountRef.current,
          silenceCount: silenceCountRef.current,
          everSpoke: everSpokeRef.current,
        };

        const last = lastMetricsRef.current;

        // 🔒 React state update ONLY if something changed
        if (
          last.isSpeaking !== nextMetrics.isSpeaking ||
          last.longPauses !== nextMetrics.longPauses ||
          last.silenceCount !== nextMetrics.silenceCount ||
          last.everSpoke !== nextMetrics.everSpoke
        ) {
          lastMetricsRef.current = nextMetrics;
          setAudioMetrics(nextMetrics);
        }

        rafIdRef.current = requestAnimationFrame(analyze);
      };

      analyze();
    }

    initMic();

    return () => {
      cancelAnimationFrame(rafIdRef.current);
      stream?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    };
  }, []);

  return audioMetrics;
}
