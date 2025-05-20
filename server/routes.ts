import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import OpenAI from "openai";

// Extend the Request type to include the multer file
declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max size
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Test API route
  app.get("/api/status", (req: Request, res: Response) => {
    res.json({ status: "ok" });
  });
  
  // Audio transcription endpoint
  app.post("/api/transcribe", upload.single('audio'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No audio file provided" });
      }
      
      // Verify we have an API key
      if (!process.env.OPENAI_API_KEY) {
        return res.status(401).json({
          error: "OpenAI API key is missing",
          details: "Please provide a valid OpenAI API key"
        });
      }
      
      // Initialize OpenAI client inside the request handler to ensure fresh API key
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      
      // Convert the buffer to a temporary file with a proper name
      const tempFilePath = path.join(process.cwd(), 'temp_audio.webm');
      fs.writeFileSync(tempFilePath, req.file.buffer);
      
      // Call OpenAI Whisper API with the temporary file path
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
        temperature: 0,
        language: "en",
      });
      
      // Clean up the temporary file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupErr) {
        console.warn('Failed to clean up temporary file:', cleanupErr);
      }
      
      res.json({ text: transcription.text });
    } catch (err: any) {
      console.error("Transcription error:", err);
      
      // Provide more detailed error information
      let errorMessage = "Failed to transcribe audio";
      let statusCode = 500;
      let details = err.message || "Unknown error";
      
      if (err.status === 401) {
        errorMessage = "Invalid OpenAI API key";
        statusCode = 401;
      } else if (err.status === 429) {
        errorMessage = "OpenAI API rate limit exceeded";
        statusCode = 429;
      } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        errorMessage = "Network error - could not connect to OpenAI API";
        statusCode = 503;
      }
      
      res.status(statusCode).json({ 
        error: errorMessage, 
        details
      });
    }
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}
