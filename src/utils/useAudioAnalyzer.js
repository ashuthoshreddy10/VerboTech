import { useEffect, useRef, useState } from "react";

export function useAudioAnalyzer() {
  const [audioMetrics, setAudioMetrics] = useState({
    isSpeaking: false,
    longPauses: 0,
  });

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  const speakingFramesRef = useRef(0);
  const silentFramesRef = useRef(0);
  const longPauseCountRef = useRef(0);

  useEffect(() => {
    let rafId;

    async function initMic() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

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
        } else {
          silentFramesRef.current++;
          speakingFramesRef.current = 0;
        }

        let isSpeaking = audioMetrics.isSpeaking;

        // Debounce logic
        if (speakingFramesRef.current > 6) {
          isSpeaking = true;
        }

        if (silentFramesRef.current > 20) {
          isSpeaking = false;
          longPauseCountRef.current++;
        }

        setAudioMetrics({
          isSpeaking,
          longPauses: longPauseCountRef.current,
        });

        rafId = requestAnimationFrame(analyze);
      };

      analyze();
    }

    initMic();

    return () => {
      cancelAnimationFrame(rafId);
      audioContextRef.current?.close();
    };
  }, []);

  return audioMetrics;
}
