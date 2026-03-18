package com.example.server.api;

//import the service that talks to gemini

import com.example.server.gemini.GeminiTextService;

// Spring annotations for REST APIs
import org.springframework.web.bind.annotation.*;

/**
 * Chat Controller
 *
 * This class defines HTTP endpoints for the backend
 * This is a middleman between the frontend and Gemini.
 */
@RestController //inform Spring that this class handle REST request
@RequestMapping("/api") //all endpoints start with /api

public class ChatController {
    private final GeminiTextService gemini;

    /**
     * Constructor: Injects GeminiTextService here
     */

    public ChatController(GeminiTextService gemini){
        this.gemini = gemini;
    }

    /**
     * POST /api/chat
     *
     * Receive JSON from frontend
     * Extract user's query
     * Sends it to gemini
     * Return gemini's answer as JSON
     */

    @PostMapping("/chat")
    public ChatResponse chat(@RequestBody ChatRequest req) throws Exception{
        //call gemini with the user's input text
        String answer = gemini.productInfo(req.query);

        return new ChatResponse(answer);
    }
}
