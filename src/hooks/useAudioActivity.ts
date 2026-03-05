import { useEffect, useState, useRef } from 'react';

export function useAudioActivity(stream: MediaStream | null, enabled: boolean = true) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !enabled) {
      setIsSpeaking(false);
      return;
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkAudio = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      
      // Threshold for "speaking"
      setIsSpeaking(average > 15);
      
      animationFrameRef.current = requestAnimationFrame(checkAudio);
    };

    checkAudio();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      audioContext.close();
    };
  }, [stream, enabled]);

  return isSpeaking;
}
