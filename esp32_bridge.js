import { WebSocketServer } from "ws";
import fs from "fs";
import { broadcastToFrontend } from "./wsHub.js";

const ESP32_PORT = 8081;
const DATA_FILE = "./data.json";

const wssESP = new WebSocketServer({ port: ESP32_PORT });
console.log(`🟢 ESP32 WS running on ws://localhost:${ESP32_PORT}`);

wssESP.on("connection", (ws) => {
  console.log("🟡 ESP32 CONNECTED");

  ws.on("message", (msg) => {
    console.log("🔥 RAW ESP32 MESSAGE:", msg.toString());

    try {
      const data = JSON.parse(msg.toString());
      console.log("📦 PARSED DATA:", data);

      const fileData = fs.existsSync(DATA_FILE)
        ? JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"))
        : { history: [] };

      fileData.history.push(data);
      fileData.history = fileData.history.slice(-20);
      fs.writeFileSync(DATA_FILE, JSON.stringify(fileData, null, 2));

      broadcastToFrontend(data);
      console.log("📡 DATA FORWARDED TO FRONTEND");

    } catch (err) {
      console.log("❌ Invalid JSON from ESP32");
      console.log(err.message);
    }
  });

  ws.on("close", () => {
    console.log("🔴 ESP32 DISCONNECTED");
  });
});
