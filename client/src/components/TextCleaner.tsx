import React from "react";
import { Check } from "lucide-react";

// Function to clean up duplicate text from transcript
const cleanDuplicates = (transcript: string[]): string[] => {
  if (transcript.length <= 1) return transcript;
  
  const cleanedTranscript: string[] = [];
  let prevText = "";
  
  for (const text of transcript) {
    // Skip empty segments
    if (!text.trim()) continue;
    
    // Check if this segment is a substring of the previous one or vice versa
    // and handle overlap
    if (
      !prevText || 
      (!prevText.includes(text) && !text.includes(prevText))
    ) {
      cleanedTranscript.push(text);
      prevText = text;
    } else if (text.length > prevText.length) {
      // Replace the previous entry with the longer version
      cleanedTranscript[cleanedTranscript.length - 1] = text;
      prevText = text;
    }
    // If current is smaller than previous, we keep the previous
  }
  
  return cleanedTranscript;
};

// Indicator component to show automatic duplicate removal is enabled
const Indicator: React.FC = () => {
  return (
    <div className="mt-4 text-xs text-muted-foreground flex items-center">
      <Check className="h-4 w-4 mr-1" />
      <span>Automatic duplicate removal enabled</span>
    </div>
  );
};

const TextCleaner = {
  cleanDuplicates,
  Indicator
};

export default TextCleaner;
