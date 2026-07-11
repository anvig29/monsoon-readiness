const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const db = require("./firebase");

// Helper to determine the risk level algorithmically
function calculateDeterministicRisk(weatherData) {
  const condText = (weatherData.conditionText || "").toLowerCase();
  const alerts = weatherData.alerts || [];
  
  // Assign "risk": "HIGH" ONLY if there is an active warning in the alerts array 
  // OR if the condition.text contains terms like "Heavy rain", "Torrential", "Thunderstorm", or "Squall"
  const hasActiveAlert = Array.isArray(alerts) && alerts.length > 0;
  const highRiskTerms = ["heavy rain", "torrential", "thunderstorm", "thundery", "thunder", "squall"];
  const isHighRiskCondition = highRiskTerms.some(term => condText.includes(term));
  
  if (hasActiveAlert || isHighRiskCondition) {
    return "HIGH";
  }
  
  // Assign "risk": "MEDIUM" if the condition.text indicates mild to moderate rain 
  // (e.g., "Light rain", "Patchy rain", "Drizzle", "Moderate rain", "Shower") without active severe alerts
  const mediumRiskTerms = ["light rain", "patchy rain", "drizzle", "moderate rain", "shower", "rain", "mist"];
  const isMediumRiskCondition = mediumRiskTerms.some(term => condText.includes(term));
  
  if (isMediumRiskCondition) {
    return "MEDIUM";
  }
  
  // Assign "risk": "LOW" if conditions are clear, sunny, or partly cloudy
  return "LOW";
}

function cleanJsonResponse(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

// Fetch current weather and alerts from weatherapi.com
app.post('/api/weather', async (req, res) => {
  const { location, apiKey } = req.body;
  
  const finalApiKey = apiKey || process.env.WEATHER_API_KEY;
  if (!finalApiKey) {
    return res.status(400).json({ error: "WeatherAPI.com Key is missing. Provide it in Settings or backend .env file." });
  }
  if (!location) {
    return res.status(400).json({ error: "Location is required." });
  }

  try {
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(finalApiKey)}&q=${encodeURIComponent(location)}&days=1&alerts=yes`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `WeatherAPI Error: ${errText || response.statusText}` });
    }

    const data = await response.json();
    
    const current = data.current || {};
    const condition = current.condition || {};
    const forecastDay = data.forecast?.forecastday?.[0]?.day || {};
    const alertsList = data.alerts?.alert || [];

    const formattedWeather = {
      locationName: `${data.location?.name || ''}, ${data.location?.region || ''}, ${data.location?.country || ''}`,
      tempC: current.temp_c,
      tempF: current.temp_f,
      conditionText: condition.text || "Unknown",
      conditionIcon: condition.icon || "",
      humidity: current.humidity,
      windKph: current.wind_kph,
      precipMm: current.precip_mm,
      maxTempC: forecastDay.maxtemp_c,
      minTempC: forecastDay.mintemp_c,
      alerts: alertsList.map(alert => ({
        event: alert.event || "Weather Alert",
        headline: alert.headline || "",
        severity: alert.severity || "",
        desc: alert.desc || "",
        instruction: alert.instruction || ""
      }))
    };

    res.json(formattedWeather);
  } catch (error) {
    console.error("Error fetching weather:", error);
    res.status(500).json({ error: `Server error fetching weather: ${error.message}` });
  }
});

app.post("/api/community-report", async (req, res) => {
  try {
    const {
      hazardType,
      location,
      observation,
      reporter,
      language
    } = req.body;

    if (!hazardType || !location || !observation) {
      return res.status(400).json({
        error: "Please fill all required fields."
      });
    }

    const report = {
      hazardType,
      location,
      observation,
      reporter: reporter || "Anonymous",
      language: language || "English",
      status: "active",
      createdAt: new Date(),
      upvotes: 0,
    };

    const doc = await db.collection("communityReports").add(report);

    res.json({
      success: true,
      id: doc.id,
      message: "Report submitted successfully."
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err.message
    });
  }
});

app.get("/api/community-report", async (req, res) => {
  try {

    const snapshot = await db
      .collection("communityReports")
      .orderBy("createdAt", "desc")
      .get();

    const reports = [];

    snapshot.forEach(doc => {
      reports.push({
        id: doc.id,
        ...doc.data()
      });
    });

    res.json(reports);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.post("/api/translate", async (req, res) => {
  try {
    const { texts, targetLanguage, openaiApiKey } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        error: "texts must be a non-empty array."
      });
    }

    const finalOpenaiKey = openaiApiKey || process.env.OPENAI_API_KEY;

    if (!finalOpenaiKey) {
      return res.status(400).json({
        error: "OpenAI API Key is missing."
      });
    }

    const openai = new OpenAI({
      apiKey: finalOpenaiKey,
    });

    const prompt = `
Translate every item in this JSON array into ${targetLanguage}.

Rules:
- Return ONLY a valid JSON array.
- Keep the same order.
- Translate naturally.
- Do not explain anything.
- Do not wrap in markdown.
- Preserve numbers and emojis.

Array:

${JSON.stringify(texts)}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a translation engine. Return only valid JSON arrays."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const raw = completion.choices[0].message.content.trim();

    const translated = JSON.parse(cleanJsonResponse(raw));

    res.json(translated);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message
    });
  }
});


app.post('/api/evaluate', async (req, res) => {
  const { 
    locationContext, 
    weatherConditions, 
    userPersona, 
    userDailyRoutine, 
    openaiApiKey,
    languagePreference,
    healthVulnerabilities
  } = req.body;

  const finalOpenaiKey = openaiApiKey || process.env.OPENAI_API_KEY;
  if (!finalOpenaiKey) {
    return res.status(400).json({ error: "OpenAI API Key is missing. Provide it in Settings or backend .env file." });
  }

  if (!weatherConditions) {
    return res.status(400).json({ error: "Weather Conditions data is missing." });
  }

  const calculatedRisk = calculateDeterministicRisk(weatherConditions);
  const targetLanguage = languagePreference || "English";

  try {
    const openai = new OpenAI({ apiKey: finalOpenaiKey });

    const systemInstruction = `You are the deterministic, zero-hallucination processing engine for Monsoon Copilot. Your objective is to evaluate weather metrics against a user's specific context, routine, and health profile to return an algorithmically grounded safety plan, translated entirely into the requested target language.

CRITICAL OPERATIONAL RULES:
1. ZERO HALLUCINATION: Rely strictly on the provided real-time weather metrics and location facts. Do not invent weather hazards that are not present in the payload. If the weather conditions are Clear, Sunny, or Partly cloudy, treat the environment as normal.
2. HEALTH GUARDRAILS: Check the "Medical Conditions / Vulnerabilities" parameter. If any chronic conditions or flags (e.g., Diabetes, Asthma, Heart Issues, osteoarthritis, mobility limits) are present, you MUST explicitly generate mitigations, tracking requirements, or emergency medication items within the actions and checklist fields (e.g., packing fast-acting glucose/sugar snacks for diabetic patients, carrying an inhaler for asthmatics, avoiding stairwells or wet/slippery routes for mobility issues).
3. EXTENSIVE TRANSLATION: You must translate EVERY single string value within the returned JSON object into the specified Language Preference: "${targetLanguage}". This includes all strings in the "appUiLabels" object. The JSON structural keys themselves must remain strictly in English exactly as defined below.

JSON KEY NAMES MUST REMAIN IN ENGLISH.

DO NOT MIX LANGUAGES.

If the selected language is Hindi, every sentence must be in Hindi.

If the selected language is Marathi, every sentence must be in Marathi.

Everything else MUST be translated.

Enforce this exact JSON structure (Do not alter key names; fill values using the requested Language Preference):
{  
  "risk": "${calculatedRisk}",  
  "preparednessScore": 85, // 0-100 score
  "topRisks": ["Explicit risk statement linking weather metrics to routine and health parameters"],  
  "actions": ["Real-world actionable step to take during the routine"],  
  "avoid": ["Specific actions, behaviors, or route types to avoid"],  
  "checklist": ["Physical gear, protective equipment, or medical supplies to carry"],  
  "communitySuggestion": "Hyper-local mutual-aid recommendation or localized reporting nudge",
  "appUiLabels": {
    "threatAnalysis": "Translated heading text for 'Threat Analysis'",
    "actionPlan": "Translated heading text for 'Action Plan'",
    "actionsAvoid": "Translated heading text for 'Actions to Avoid'",
    "gearChecklist": "Translated heading text for 'Physical Gear Checklist'",
    "communityTitle": "Translated title text for 'Community Mutual Aid Hub'",
    "communityTagline": "Translated inspiring community tagline message"
  }
}

JSON OUTPUT CONSTRAINT: Return ONLY the raw JSON object string. Do NOT wrap the response in markdown blocks like \`\`\`json or \`\`\`. Start your response directly with { and end it directly with }.`;

    const userPrompt = `Input Parameters:
- Language Preference: ${targetLanguage}
- Location Context: ${locationContext || "Unknown"}
- Weather Conditions: ${JSON.stringify(weatherConditions)}
- User Persona: ${userPersona || "General Resident"}
- User Daily Routine: ${userDailyRoutine || "Normal daily tasks"}
- Medical Conditions / Vulnerabilities: ${healthVulnerabilities || "None"}

Generate the JSON daily action plan.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
    });

    const aiResponseText = completion.choices[0]?.message?.content || "";
    const cleanedText = cleanJsonResponse(aiResponseText);
    
    let actionPlan;
    try {
      actionPlan = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("AI output was not valid JSON, raw text:", aiResponseText);
      return res.status(500).json({ 
        error: "AI did not return a valid raw JSON object. Please try again.",
        rawText: aiResponseText 
      });
    }

    // Programmatically enforce risk field to prevent any model deviation
    actionPlan.risk = calculatedRisk;

    // Post-process to prevent low-risk hallucinations if model slipped up
    if (calculatedRisk === "LOW" && targetLanguage.toLowerCase() === "english") {
      actionPlan.topRisks = actionPlan.topRisks.map(r => 
        r.replace(/raincoat|umbrella|flood|storm|heavy rain/gi, "weather issues")
      );
      actionPlan.actions = actionPlan.actions.map(a => 
        a.replace(/raincoat|umbrella|flood|storm|heavy rain/gi, "weather issues")
      );
      actionPlan.avoid = actionPlan.avoid.map(av => 
        av.replace(/raincoat|umbrella|flood|storm|heavy rain/gi, "weather issues")
      );
      actionPlan.checklist = actionPlan.checklist.filter(item => 
        !/raincoat|umbrella/gi.test(item)
      );
      if (actionPlan.checklist.length === 0) {
        actionPlan.checklist = ["Water bottle", "Standard essentials"];
      }
    }

    res.json(actionPlan);
  } catch (error) {
    console.error("Error generating daily action plan:", error);
    res.status(500).json({ error: `Server error generating plan: ${error.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`Monsoon Copilot backend running on port ${PORT}`);
});
