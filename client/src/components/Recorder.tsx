import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";

interface RecorderProps {
  isRecording: boolean;
  onTranscriptionUpdate: (text: string) => void;
  onTranscriptionError: (error: Error) => void;
  onStatusChange: (status: "Ready" | "Recording..." | "Transcribing..." | "Complete") => void;
  onLatencyUpdate: (ms: number) => void;
}

const Recorder = forwardRef<any, RecorderProps>(({ 
  isRecording, 
  onTranscriptionUpdate, 
  onTranscriptionError,
  onStatusChange,
  onLatencyUpdate
}, ref) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const processingChunksRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);

  useImperativeHandle(ref, () => ({
    getRecorder: () => mediaRecorderRef.current
  }));

  useEffect(() => {
    if (isRecording) {
      startRecording();
    } else if (mediaRecorderRef.current) {
      stopRecording();
    }
    
    return () => {
      if (recordingIntervalRef.current) {
        window.clearInterval(recordingIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      mediaRecorderRef.current = new MediaRecorder(streamRef.current);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.start();
      startTimeRef.current = Date.now();
      
      // Set up the interval to record in chunks (5 seconds with 500ms overlap)
      recordingIntervalRef.current = window.setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          processAudioChunk();
        }
      }, 4500); // 5000ms - 500ms overlap = 4500ms interval
      
    } catch (err: any) {
      console.error('Error starting recording:', err);
      throw new Error(`Microphone access denied: ${err.message}`);
    }
  };
  
  const stopRecording = () => {
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      
      // Process any remaining audio
      if (audioChunksRef.current.length > 0) {
        processAudioChunk(true);
      }
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };
  
  const processAudioChunk = async (isLastChunk = false) => {
    if (processingChunksRef.current) return;
    
    processingChunksRef.current = true;
    onStatusChange("Transcribing...");
    
    try {
      const startTime = Date.now();
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      if (audioBlob.size > 0) {
        const formData = new FormData();
        formData.append('audio', audioBlob);
        
        // Create a non-JSON fetch request
        const response = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Transcription failed');
        }
        
        const result = await response.json();
        
        // Calculate latency
        const endTime = Date.now();
        const latency = endTime - startTime;
        onLatencyUpdate(latency);
        
        if (result.text) {
          onTranscriptionUpdate(result.text);
        }
      }
      
      // Clear the chunks after processing if not the last chunk
      if (!isLastChunk) {
        // Keep the last 500ms (overlap) by keeping the last chunk
        if (audioChunksRef.current.length > 1) {
          audioChunksRef.current = [audioChunksRef.current[audioChunksRef.current.length - 1]];
        }
      } else {
        audioChunksRef.current = [];
      }
      
      // Reset status back to Recording if still recording
      if (isRecording && !isLastChunk) {
        onStatusChange("Recording...");
      }
      
    } catch (err: any) {
      console.error('Error processing audio chunk:', err);
      onTranscriptionError(err);
    } finally {
      processingChunksRef.current = false;
    }
  };

  return (
    <div className="bg-accent rounded-lg h-16 mb-4 flex items-center justify-center border border-border">
      <div className="flex items-center space-x-1">
        {isRecording ? (
          // Active microphone visualization
          <>
            <div className="h-4 w-1 bg-primary rounded animate-pulse" style={{ animationDelay: "0ms" }}></div>
            <div className="h-6 w-1 bg-primary rounded animate-pulse" style={{ animationDelay: "100ms" }}></div>
            <div className="h-10 w-1 bg-primary rounded animate-pulse" style={{ animationDelay: "200ms" }}></div>
            <div className="h-8 w-1 bg-primary rounded animate-pulse" style={{ animationDelay: "300ms" }}></div>
            <div className="h-5 w-1 bg-primary rounded animate-pulse" style={{ animationDelay: "400ms" }}></div>
            <div className="h-7 w-1 bg-primary rounded animate-pulse" style={{ animationDelay: "500ms" }}></div>
            <div className="h-3 w-1 bg-primary rounded animate-pulse" style={{ animationDelay: "600ms" }}></div>
          </>
        ) : (
          // Inactive microphone visualization
          <>
            <div className="h-4 w-1 bg-muted rounded"></div>
            <div className="h-6 w-1 bg-muted rounded"></div>
            <div className="h-10 w-1 bg-muted rounded"></div>
            <div className="h-8 w-1 bg-muted rounded"></div>
            <div className="h-5 w-1 bg-muted rounded"></div>
            <div className="h-7 w-1 bg-muted rounded"></div>
            <div className="h-3 w-1 bg-muted rounded"></div>
          </>
        )}
      </div>
    </div>
  );
});

Recorder.displayName = "Recorder";

export default Recorder;
