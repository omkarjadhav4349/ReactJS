import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY is missing. Check your .env file!");
}

const ai = new GoogleGenAI({ apiKey: apiKey });

app.post('/api/chat', async (req, res) => {
    try {
        const { prompt, history = [] } = req.body;
        
        if (!prompt || prompt.trim() === '') {
            throw new Error("Prompt is empty");
        }

        // 1. CLEAN: Strip out empty or error messages
        const cleanHistory = history.filter(msg => 
            msg && msg.text && typeof msg.text === 'string' && msg.text.trim() !== '' &&
            !msg.text.includes('Error:') && !msg.text.includes('Sorry, I encountered')
        );

        // 2. ENFORCE PERFECT PATTERN: Google requires strict alternating roles (user, model, user, model)
        const contents = [];
        let expectedRole = 'user';

        for (const msg of cleanHistory) {
            const role = msg.sender === 'user' ? 'user' : 'model';
            if (role === expectedRole) {
                contents.push({ role: role, parts: [{ text: msg.text }] });
                expectedRole = (role === 'user') ? 'model' : 'user';
            }
        }

        // If the history array accidentally ends with a 'user' message, remove it.
        // We must do this because the NEW prompt we are about to add is also a 'user' message!
        if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
            contents.pop();
        }

        // 3. Append the new prompt
        contents.push({ role: 'user', parts: [{ text: prompt }] });

        // 4. STREAM directly (bypassing the fragile chat session wrapper)
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');

        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: contents
        });

        for await (const chunk of responseStream) {
            res.write(chunk.text);
        }
        
        res.end();
        
    } catch (error) {
        console.error("AI Error Details:", error.message || error);
        res.status(500).send("Error communicating with AI");
    }
});

app.listen(3001, () => console.log('Backend running on port 3001'));