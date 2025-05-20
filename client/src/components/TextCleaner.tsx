import React from "react";
import { Check } from "lucide-react";

// Function to clean up duplicate text from transcript with improved handling
const cleanDuplicates = (transcript: string[]): string[] => {
  if (transcript.length <= 1) return transcript;
  
  const cleanedTranscript: string[] = [];
  let prevText = "";
  
  for (const text of transcript) {
    // Skip empty segments
    if (!text.trim()) continue;
    
    // Helper function to get word boundaries
    const getWords = (str: string) => str.toLowerCase().trim().split(/\s+/);
    const currentWords = getWords(text);
    
    // If we have no previous text, just add it
    if (!prevText) {
      cleanedTranscript.push(text);
      prevText = text;
      continue;
    }
    
    const prevWords = getWords(prevText);
    
    // Check for partial word overlaps by looking at the last few words of prev and first few of current
    const overlapSize = Math.min(3, prevWords.length, currentWords.length);
    let isPartialOverlap = false;
    
    // Check for partial overlap at the end of previous and start of current text
    for (let i = 1; i <= overlapSize; i++) {
      const prevTail = prevWords.slice(prevWords.length - i).join(' ');
      const currentHead = currentWords.slice(0, i).join(' ');
      
      if (prevTail === currentHead) {
        isPartialOverlap = true;
        break;
      }
    }
    
    // Full containment check (one is subset of the other)
    const isFullOverlap = prevText.includes(text) || text.includes(prevText);
    
    // Make decision based on overlap type
    if (!isFullOverlap && !isPartialOverlap) {
      // No overlap, add as new entry
      cleanedTranscript.push(text);
      prevText = text;
    } else if (isFullOverlap) {
      // Full overlap, keep the longer one
      if (text.length > prevText.length) {
        cleanedTranscript[cleanedTranscript.length - 1] = text;
        prevText = text;
      }
      // If current is smaller than previous, we keep the previous
    } else if (isPartialOverlap) {
      // For partial overlaps, join them without the duplicate words
      const joinedText = combinePartialOverlaps(prevText, text);
      cleanedTranscript[cleanedTranscript.length - 1] = joinedText;
      prevText = joinedText;
    }
  }
  
  return cleanedTranscript;
};

// Helper function to combine texts with partial word overlaps
const combinePartialOverlaps = (prevText: string, currentText: string): string => {
  const prevWords = prevText.toLowerCase().trim().split(/\s+/);
  const currentWords = currentText.toLowerCase().trim().split(/\s+/);
  
  // Try different overlap sizes (from largest to smallest)
  for (let overlapSize = Math.min(prevWords.length, currentWords.length); overlapSize > 0; overlapSize--) {
    const prevTail = prevWords.slice(prevWords.length - overlapSize).join(' ');
    const currentHead = currentWords.slice(0, overlapSize).join(' ');
    
    if (prevTail === currentHead) {
      // Found the overlap, combine texts
      const prevTextPart = prevText.substring(0, prevText.toLowerCase().lastIndexOf(prevTail));
      // Preserve original casing by using the current text's version
      return prevTextPart + currentText;
    }
  }
  
  // If no specific overlap found, just concatenate with a space
  return prevText + ' ' + currentText;
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
