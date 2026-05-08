import { useState, useEffect, useRef, useCallback } from "react";

export function useSpeechRecognition(enabled = true, sessionId = "default-session") {
  const [transcript] = useState("");
  const transcriptRef = useRef(""); 
  
  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processorRef = useRef(null);
  const [liveScore, setLiveScore] = useState(null);

  useEffect(() => {
    if (!enabled) {
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
      return;
    }

    const startStreaming = async () => {
      try {
        // Connect to FastAPI WebSocket streaming endpoint
        wsRef.current = new WebSocket(`ws://localhost:8000/ws/stream/${sessionId}`);
        
        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.confidence_score !== undefined) {
              setLiveScore(data.confidence_score);
            }
          } catch (error) {
            console.error(error);
          }
        };

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        // 4096 buffer size (~250ms at 16k)
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            const inputData = e.inputBuffer.getChannelData(0);
            // Send raw Float32Array as binary
            wsRef.current.send(inputData.buffer);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        
        console.log("🎤 Streaming RAW PCM Float32 STARTED (16kHz)");
      } catch (err) {
        console.error("🎤 Failed to access microphone:", err);
      }
    };

    startStreaming();

    return () => {
      // Cleanup streams on unmount
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [enabled, sessionId]);

  // Expose a method to trigger Server-Side PyTorch prediction
  const finishSession = useCallback(async (config = {}) => {
    return new Promise((resolve) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          resolve({ confidence_score: 0.0, delta_score: 0 }); // Fallback if socket closed early
          return;
      }
      
      // Temporarily override the message handler to capture the final deep learning score
      wsRef.current.onmessage = (event) => {
          try {
              const data = JSON.parse(event.data);
              if (data.confidence_score !== undefined) {
                  resolve({
                    confidence_score: data.confidence_score,
                    delta_score: data.delta_score || 0
                  });
              }
          } catch {
              resolve({ confidence_score: 50.0, delta_score: 0 });
          }
      };

      wsRef.current.onclose = () => resolve({ confidence_score: 0.0, delta_score: 0 });
      wsRef.current.onerror = () => resolve({ confidence_score: 0.0, delta_score: 0 });

      // Safety timeout
      setTimeout(() => resolve({ confidence_score: 0.0, delta_score: 0 }), 35000);

      // Fire the trigger packet with personalization context
      console.log("Transmission Complete. Sending Inference Trigger with context...");
      wsRef.current.send(JSON.stringify({ 
        action: "finish",
        user_id: config?.user_id || "anonymous",
        is_onboarding: config?.is_onboarding || false
      }));
    });
  }, []);

  // Expose a method for the MediaPipe loop to send tensors
  const sendVisionTensors = useCallback((tensorArray) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
          type: "tensor",
          data: tensorArray
      }));
    }
  }, []);

  return { transcript, transcriptRef, finishSession, liveScore, sendVisionTensors };
}
