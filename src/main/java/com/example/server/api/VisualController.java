package com.example.server.api;

import com.example.server.gemini.GeminiVisionService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

public class VisualController {
    private final GeminiVisionService vision;

    public VisualController(GeminiVisionService vision){
        this.vision = vision;
    }

    @PostMapping(value = "/vision", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ChatResponse vision(
            @RequestPart("image") MultipartFile image,
            @RequestPart(value = "question", required = false) String question
    ) throws Exception{
        String answer = vision.analyzeImage(image.getBytes(), image.getContentType(), question);
        return new ChatResponse(answer);
    }
}
