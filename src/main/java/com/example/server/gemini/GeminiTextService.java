package com.example.server.gemini;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import okhttp3.*;
import org.springframework.stereotype.Service;

@Service
public class GeminiTextService {
    // Tells OkHttp that we are sending JSON data
    private static final MediaType JSON =
            MediaType.get("application/json; charset=utf-8");

    private final OkHttpClient client = new OkHttpClient();

    //object mapper helps parse JSON string into Java strings
    private final ObjectMapper mapper = new ObjectMapper();

    //base url for gemini's text generation endpoint
    private static final String URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=";

     /**
     * Sends a product name to Gemini and returns Gemini's explanation.
     *
     * @param query the product name typed by the user (e.g. "quaker plain oats")
     * @return Gemini's response text
     */

     public String productInfo(String query) throws Exception{
         //read the gemini api key
         String key = System.getenv("GEMINI_API_KEY");

         if(key == null || key.isBlank()){
             throw new RuntimeException("GEMINI_API_KEY not set");
         }
         //this is the prompt that will be sent to gemini
         String prompt = """
                 You are a grocery product assistant.
                       Given only a product name, answer with:
                       - Quick summary
                       - Common ingredients (say if unsure)
                       - Allergens to watch for
                       - Nutrition considerations (no exact numbers)
                       - What to verify on the label
                       Product: %s
                """.formatted(query);

         //build the json body that gemini expects
         // "contents" → list of messages
         // "parts" → text content of the message

         String bodyJson = """
                {
                    "contents": [
                     {
                         "role": "user",
                         "parts": [
                           { "text": %s }
                         ]
                       }
                    ]
                }
                """.formatted(mapper.writeValueAsString(prompt));

         //create the HTTP POST request to gemini
         Request req = new Request.Builder()
                 .url(URL + key) //url include API key
                 .post(RequestBody.create(bodyJson, JSON)) //send JSON body
                 .build();

         //finally send request to Gemini and receive its response
         //try-with ensures the response if properly closed

         try(Response resp = client.newCall(req).execute()){
             //Read the response body as a raw string
             String raw = resp.body() == null ? "" : resp.body().string();

             //if gemini return an error
             if(!resp.isSuccessful()){
                 throw new RuntimeException("Gemini error: " + resp.code() + " " + raw);
             }

             //parse the raw json into a tree structure
             JsonNode root = mapper.readTree(raw);

             //navigate to the actual response of gemini
             // Path: candidates[0] → content → parts[0] → text
             JsonNode textNode = root.at("/candidates/0/content/parts/0/text");

             // If parsing fails, return the raw JSON (useful for debugging)
             // Otherwise, return just the AI-generated text
             return textNode.isMissingNode() ? raw : textNode.asText();


         }

     }

}
