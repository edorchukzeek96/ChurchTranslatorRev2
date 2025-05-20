import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import OpenAI from "openai";

// Configure OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ""
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max size
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Test API route
  app.get("/api/status", (req, res) => {
    res.json({ status: "ok" });
  });
  
  // Audio transcription endpoint
  app.post("/api/transcribe", upload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }
      
      // Create a readable stream from the buffer
      const audioStream = Readable.from(req.file.buffer);
      
      // Call OpenAI Whisper API
      const transcription = await openai.audio.transcriptions.create({
        file: audioStream,
        model: "whisper-1",
      });
      
      res.json({ text: transcription.text });
    } catch (err: any) {
      console.error("Transcription error:", err);
      res.status(500).json({ 
        error: "Failed to transcribe audio", 
        details: err.message 
      });
    }
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
