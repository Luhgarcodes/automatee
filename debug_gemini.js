require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

(async () => {
    try {
        const genAI = new GoogleGenerativeAI(process.env.API_KEY);
        // We can't easily list models without a specific call, but let's try gemini-pro which is the most stable
        console.log("Testing gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Say hello");
        console.log("Success with gemini-1.5-flash:", result.response.text());
    } catch (err) {
        console.error("Error with gemini-1.5-flash:", err.message);
        
        try {
            console.log("\nTesting gemini-1.5-pro...");
            const genAI = new GoogleGenerativeAI(process.env.API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
            const result = await model.generateContent("Say hello");
            console.log("Success with gemini-1.5-pro:", result.response.text());
        } catch (err2) {
            console.error("Error with gemini-1.5-pro:", err2.message);
        }
    }
})();
