import { useEffect, useState, useRef } from 'react';

let sharedAudioContext: AudioContext | null = null;
const getAudioContext = () => {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return sharedAudioContext;
};

export function useAudioActivity(stream: MediaStream | null, enabled: boolean = true) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!stream || !enabled) {
      setIsSpeaking(false);
      setVolume(0);
      return;
    }

    const audioContext = getAudioContext();
    
    // Resume context if it's suspended (common browser behavior)
    if (audioContext.state === 'suspended') {
      const resume = () => audioContext.resume();
      window.addEventListener('click', resume, { once: true });
      window.addEventListener('touchstart', resume, { once: true });
    }

    let analyser: AnalyserNode;
    
    try {
      // Create source from the stream
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;
    } catch (err) {
      console.error("Error setting up audio analyser:", err);
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkAudio = () => {
      if (!analyserRef.current) return;
      
      try {
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        let count = 0;
        // Peak selection for better reactive volume
        for (let i = 0; i < bufferLength; i++) {
          if (dataArray[i] > 0) {
            sum += dataArray[i];
            count++;
          }
        }
        const average = count > 0 ? sum / count : 0;
        
        setVolume(average);
        // Lower threshold for better sensitivity
        setIsSpeaking(average > 8);
      } catch (err) {
        console.error("Error reading frequency data:", err);
      }
      
      animationFrameRef.current = requestAnimationFrame(checkAudio);
    };

    checkAudio();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      analyserRef.current = null;
    };
  }, [stream, enabled]);

  return { isSpeaking, volume };
}
