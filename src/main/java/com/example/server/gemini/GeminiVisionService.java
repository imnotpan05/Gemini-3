package com.example.server.gemini;


import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;
import org.springframework.stereotype.Service;

import java.util.Base64;

@Service
public class GeminiVisionService {
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
    private final OkHttpClient client = new OkHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    private static final String URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=";

    public String analyzeImage(byte[] imageBytes, String mimeType, String question) throws Exception{
        //read the Gemini API key from the environment variables
        String key = System.getenv("GEMINI_API_KEY");


        //fail fast if the API key is missing
        if(key == null || key.isBlank()){
            throw new RuntimeException("GEMINI_API_KEY not sent");
        }

        //if frontend did not provide a MIME type, default to JPEG

        if(mimeType == null || mimeType.isBlank()){
            mimeType = "image/jpeg";
        }
        //convert the image bytes into base64 text
        String b64 = Base64.getEncoder().encodeToString(imageBytes);

        //if the user does not ask a question, usea default instruction
        String prompt = (question == null || question.isBlank())
            ? "Look at this product photo. Summarize what it is, extract any visible ingredients, allergens, and nutrition highlights. If text is unreadable, ask the user to retake a closer photo of the product."
                : question;

        /**
         * build JSON request
         * - text prompt
         * - inline image data
         */

        String bodyJson = """
                {
                    "contents": [
                        {
                            "role": "user",
                            "parts": [
                                      { "text": %s },
                                      {
                                        "inline_data": {
                                          "mime_type": %s,
                                          "data": %s
                                        }
                                      }
                                    ]
                        }
                    ]
                }
                
                """.formatted(
                        mapper.writeValueAsString(prompt),
                        mapper.writeValueAsString(mimeType),
                        mapper.writeValueAsString(b64)
        );

        //build the HTTP POST request to Gemini
        Request req = new Request.Builder()
                .url(URL + key) //gemini endpoint + API key
                .post(RequestBody.create(bodyJson, JSON))
                .build();

        //send the POST request to gemini and read its response
        try (Response resp = client.newCall(req).execute()){
            String raw = resp.body() == null ? "" : resp.body().string();

            // If Gemini returned an error (401, 429, 500, etc.), throw an exception
            if(!resp.isSuccessful()){
                throw new RuntimeException("Gemini error: " + resp.code() + " " + raw);
            }

            // Parse the JSON response into a tree structure
            JsonNode root = mapper.readTree(raw);

            //Navigate to the actual AI generated text
            JsonNode textNode = root.at("/candidates/0/content/parts/0/text");

            //if parsing fails, return the raw JSON (useful for debugging)
            //otherwise, return the ai generated text after parsing

            return textNode.isMissingNode() ? raw : textNode.asText();


        }
    }

}
