// server.js
import express from "express";
import cors from "cors";
import fs from "fs";
import axios from "axios";

import "./wsHub.js";        // start frontend WS
import "./esp32Bridge.js"; // start ESP32 WS

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const DATA_FILE = "./data.json";
const GROQ_API_KEY = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

const SYSTEM_MESSAGE = `
You are an AI assistant operating as a CHILD SAFETY MONITORING SYSTEM.

You are provided with a sequence of recent sensor records representing the child’s state over time.
Each record reflects a moment, and the order represents progression in time.

YOUR ROLE:
- Interpret the child’s condition by comparing the most recent record with several previous records.
- Infer trends such as sustained movement, sudden stops, repeated inactivity, or abrupt changes.
- Detect danger, medical risk, abnormal patterns, or emergencies based on changes over time.
- Detect false, impossible, contradictory, or unreliable data and treat it as INVALID.

TEMPORAL REASONING RULES:
- Always consider the most recent record in the context of the previous records.
- Look for patterns such as repeated immobility, sudden transitions, or worsening conditions.
- Conflicting signals across time must increase risk, not reduce it.

CRITICAL RULES:
- Do NOT repeat, quote, summarize, or list the contents of the JSON.
- Do NOT output raw numbers, coordinates, or field names.
- Do NOT describe exact locations or directions.
- Infer behavior only in abstract terms.
- Do NOT speculate beyond the provided records.

RISK CLASSIFICATION RULES:
- NONE: Normal behavior.
- LOW: Minor irregularity.
- MEDIUM: Fall or abnormal behavior.
- HIGH: Fall with immobility or danger.
- EXTREME: Life-threatening emergency.

OUTPUT FORMAT (MANDATORY):

(Explain the current situation in natural language using 2–3 short sentences.)

RISK: <NONE | LOW | MEDIUM | HIGH | EXTREME>
`;

/* ================== AI ANALYZE ================== */
app.get("/analyze", async (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({ result: "No monitoring data.\n\nRISK: NONE" });
    }

    const history =
      JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")).history || [];

    if (!history.length) {
      return res.json({ result: "Insufficient data.\n\nRISK: NONE" });
    }

    const recentRecords = history.slice(-5);

    try {
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: SYSTEM_MESSAGE },
            { role: "user", content: JSON.stringify(recentRecords) }
          ],
          temperature: 0.2
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`, // ✅ FIXED
            "Content-Type": "application/json"
          },
          timeout: 5000 // ✅ VERY IMPORTANT
        }
      );

      return res.json({
        result: response.data.choices[0].message.content
      });

    } catch (err) {
      console.warn("⚠️ AI unavailable, using fallback", err.message);
    }

    const last = recentRecords.at(-1);
    let risk = "NONE";
    let msg = "Normal activity detected.";

    if (last.falling) {
      risk = "MEDIUM";
      msg = "A fall was detected recently.";
    }

    if (!last.moving && last.heartRate < 40) {
      risk = "EXTREME";
      msg = "No movement with dangerous vitals.";
    }

    res.json({ result: `${msg}\n\nRISK: ${risk}` });

  } catch (err) {
    console.error(err);
    res.json({
      result: "System error.\n\nRISK: HIGH"
    });
  }
});

/* ================== START SERVER ================== */
app.listen(3000, () => {
  console.log("🌐 HTTP server running at http://localhost:3000");
});
