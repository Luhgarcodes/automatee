require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

(async () => {
    try {
        const genAI = new GoogleGenerativeAI(process.env.API_KEY);
        // Using fetch to get the list directly since SDK might be abstracting too much
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.API_KEY}`);
        const data = await response.json();
        
        if (data.models) {
            console.log("--- Available Models for your Key ---");
            data.models.forEach(m => {
                const parts = m.name.split('/');
                const shortName = parts[parts.length - 1];
                if (m.supportedGenerationMethods.includes("generateContent")) {
                  console.log(`- ${shortName} (Supported)`);
                } else {
                  console.log(`- ${shortName}`);
                }
            });
        } else {
            console.log("No models returned. Data:", JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error("Critical error listing models:", err.message);
    }
})();
