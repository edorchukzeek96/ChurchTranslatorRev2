import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

interface RecorderProps {
  isRecording: boolean;
  onTranscriptionUpdate: (text: string) => void;
  onTranscriptionError: (error: Error) => void;
  onStatusChange: (status: "Ready" | "Recording..." | "Transcribing..." | "Complete") => void;
  onLatencyUpdate: (ms: number) => void;
}

interface RecorderRef {
  getRecorder: () => MediaRecorder | null;
  retryMicrophoneAccess: () => Promise<boolean>;
}

const Recorder = forwardRef<RecorderRef, RecorderProps>(({ 
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
  const retryCountRef = useRef<number>(0);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [microphoneDisconnected, setMicrophoneDisconnected] = useState<boolean>(false);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    getRecorder: () => mediaRecorderRef.current,
    retryMicrophoneAccess: async () => {
      try {
        setMicrophoneDisconnected(false);
        await startRecording();
        return true;
      } catch (err) {
        return false;
      }
    }
  }));

  useEffect(() => {
    if (isRecording) {
      startRecording();
    } else if (mediaRecorderRef.current) {
      stopRecording();
    }
    
    return () => {
      cleanupResources();
    };
  }, [isRecording]);

  // Monitor microphone connection
  useEffect(() => {
    if (!streamRef.current) return;
    
    const tracks = streamRef.current.getAudioTracks();
    if (tracks.length === 0) return;
    
    const track = tracks[0];
    
    // Handle microphone disconnection
    const handleTrackEnded = () => {
      console.warn('Microphone disconnected');
      setMicrophoneDisconnected(true);
      if (isRecording) {
        stopRecording();
        onTranscriptionError(new Error('Microphone disconnected'));
      }
    };
    
    track.addEventListener('ended', handleTrackEnded);
    
    return () => {
      track.removeEventListener('ended', handleTrackEnded);
    };
  }, [streamRef.current, isRecording]);

  const cleanupResources = () => {
    if (recordingIntervalRef.current) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      // Clean up any existing resources first
      cleanupResources();
      
      // Request microphone access
      streamRef.current = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true 
        } 
      });
      
      // Create new MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(streamRef.current);
      audioChunksRef.current = [];
      
      // Set up data handler
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Set up error handler
      mediaRecorderRef.current.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        onTranscriptionError(new Error('Recording error occurred'));
      };
      
      // Start recording
      mediaRecorderRef.current.start(5000); // Collect data every second for smoother processing
      startTimeRef.current = Date.now();
      setMicrophoneDisconnected(false);
      
      // Corrected logic for 5-second chunks with 500ms overlap
      recordingIntervalRef.current = window.setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          processAudioChunk(false);
        }
      }, 5000); // stream every 5 seconds
      
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setMicrophoneDisconnected(true);
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
    setIsTranscribing(true);
    onStatusChange("Transcribing...");
    retryCountRef.current = 0;
    
    try {
      const startTime = Date.now();
      const audioBlob = new Blob([audioChunksRef.current[audioChunksRef.current.length - 1]], { type: 'audio/webm' });

      
      if (audioBlob.size > 0) {
        await sendAudioForTranscription(audioBlob, startTime);
      }
      
      // Clear the chunks after processing if not the last chunk
      if (!isLastChunk) {
        // Keep the last 500ms (overlap) by keeping the last chunk
        if (audioChunksRef.current.length > 1) {
          // Keep the last 1-2 chunks for overlap
          const keepCount = Math.min(2, audioChunksRef.current.length);
          audioChunksRef.current = audioChunksRef.current.slice(-keepCount);
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
      // Error handling is now in the sendAudioForTranscription function
    } finally {
      processingChunksRef.current = false;
      setIsTranscribing(false);
    }
  };

  const sendAudioForTranscription = async (audioBlob: Blob, startTime: number): Promise<void> => {
    const MAX_RETRIES = 3;
    let currentTry = 0;
    
    while (currentTry < MAX_RETRIES) {
      try {
        const formData = new FormData();
        formData.append('file', audioBlob);
        formData.append('model', 'whisper-1');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer your-openai-api-key`,
            'Content-Type': 'multipart/form-data',
          },
          body: formData,
        });

        
        if (!response.ok) {
          throw new Error(`Transcription failed with status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Calculate latency
        const endTime = Date.now();
        const latency = endTime - startTime;
        onLatencyUpdate(latency);
        
        if (result.text) {
          console.log("Transcription received:", result.text);
          onTranscriptionUpdate(result.text);
        }

        
        // Success! Exit the retry loop
        return;
        
      } catch (err: any) {
        currentTry++;
        console.error(`Transcription attempt ${currentTry} failed:`, err);
        
        // If we have more retries left, delay and try again
        if (currentTry < MAX_RETRIES) {
          retryCountRef.current = currentTry;
          await new Promise(resolve => setTimeout(resolve, 1000 * currentTry)); // Increasing backoff
        } else {
          // We've exhausted all retries
          onTranscriptionError(err);
          throw err; // Re-throw to be caught by the outer try/catch
        }
      }
    }
  };

  return (
    <div className="bg-accent rounded-lg h-16 mb-4 flex items-center justify-center border border-border relative">
      {microphoneDisconnected && (
        <div className="absolute inset-0 bg-destructive/10 flex items-center justify-center rounded-lg">
          <div className="text-destructive text-sm text-center p-2">
            Microphone disconnected
          </div>
        </div>
      )}
    
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
      
      {isTranscribing && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}
      
      {retryCountRef.current > 0 && (
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-xs text-warning">
          Retry: {retryCountRef.current}/3
        </div>
      )}
    </div>
  );
});

Recorder.displayName = "Recorder";

export default Recorder;
