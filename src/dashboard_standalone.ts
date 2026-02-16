import blessed from "blessed";
import contrib from "blessed-contrib";
import { storage } from "./db.js";
import os from "os";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

// Error handling to prevent the [Object: null prototype] crash
process.on('uncaughtException', (err) => {
    fs.appendFileSync('dashboard_error.log', `Uncaught Exception: ${err.stack}\n`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    fs.appendFileSync('dashboard_error.log', `Unhandled Rejection: ${reason}\n`);
});

const screen = blessed.screen({ smartCSR: true, title: "Gemini AI PRO Admin Panel", fullUnicode: true });
const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

// --- Widgets ---
const chatTable = grid.set(0, 0, 6, 8, contrib.table, {
  keys: true,
  fg: "white",
  selectedFg: "black",
  selectedBg: "cyan",
  interactive: true,
  label: "Live Chats (Enter to Reply)",
  columnSpacing: 1,
  columnWidth: [12, 8, 40],
});

const userTable = grid.set(0, 8, 6, 4, contrib.table, {
  label: "Top Users",
  fg: "yellow",
  columnWidth: [15, 8],
});

const logView = grid.set(6, 0, 4, 8, contrib.log, {
  fg: "green",
  label: "Application Live Logs",
  border: { type: "line" }
});

const activityLine = grid.set(6, 8, 4, 4, contrib.bar, {
  label: "Activity (24h)",
  barWidth: 4,
  barSpacing: 2,
  xOffset: 0,
  maxHeight: 10,
});

const sysInfo = grid.set(10, 0, 2, 8, blessed.box, {
  label: "System Status",
  tags: true,
  border: { type: "line" },
  style: { border: { fg: "magenta" } }
});

const userInput = grid.set(10, 8, 2, 4, blessed.textbox, {
  label: "Quick Reply (Press Enter)",
  mouse: true,
  keys: true,
  inputOnFocus: true,
  style: { focus: { border: { fg: "green" } } },
  border: { type: "line" }
});

let selectedUserId: number | null = null;
let currentChats: any[] = [];
let lastLogPosition = 0;

function updateLogs() {
    try {
        const logDir = "logs";
        if (!fs.existsSync(logDir)) return;
        
        const files = fs.readdirSync(logDir).filter(f => f.endsWith('.log')).sort();
        if (files.length === 0) return;

        const latestLog = path.join(logDir, files[files.length - 1]);
        const stats = fs.statSync(latestLog);

        if (lastLogPosition === 0) {
            lastLogPosition = Math.max(0, stats.size - 5000);
        }

        if (stats.size > lastLogPosition) {
            const fd = fs.openSync(latestLog, 'r');
            const length = stats.size - lastLogPosition;
            const buffer = Buffer.alloc(length);
            fs.readSync(fd, buffer, 0, length, lastLogPosition);
            fs.closeSync(fd);

            const lines = buffer.toString('utf8').split('\n');
            lines.forEach(line => {
                if (line.trim()) logView.log(line.trim());
            });
            lastLogPosition = stats.size;
        }
    } catch (e) {}
}

function refresh() {
  try {
    currentChats = storage.getRecentChats(15) || [];
    chatTable.setData({
      headers: ["User", "Role", "Content"],
      data: currentChats.map(c => [c.username || '?', c.role || '?', String(c.content || '').substring(0, 40)])
    });

    const users = storage.getUserStats() || [];
    userTable.setData({
      headers: ["Username", "Msgs"],
      data: users.map(u => [u.username || '?', String(u.total_messages || 0)])
    });

    const activity = storage.getHourlyActivity() || [];
    if (activity.length > 0) {
        activityLine.setData({
          titles: activity.map(a => a.hour + "h"),
          data: activity.map(a => a.count)
        });
    }

    const memUsed = Math.floor((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024);
    const totalMem = Math.floor(os.totalmem() / 1024 / 1024 / 1024);
    const usage = storage.getApiUsage() || { total_input: 0, total_output: 0 };
    const modelName = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

    sysInfo.setContent(
      `CPU: ${os.loadavg()[0].toFixed(2)} | RAM: ${memUsed}/${totalMem}GB\n` +
      `API: ${modelName} | In: ${usage.total_input.toLocaleString()} Out: ${usage.total_output.toLocaleString()}`
    );

    screen.render();
  } catch (e) {}
}

chatTable.rows.on('select', (item, index) => {
    const chat = currentChats[index];
    if (chat) {
        selectedUserId = chat.user_id;
        userInput.focus();
        screen.render();
    }
});

userInput.on('submit', (value) => {
    if (selectedUserId && value) {
        storage.enqueueOutbound(selectedUserId, value);
        userInput.clearValue();
        logView.log(`Reply sent to ${selectedUserId}: ${value}`);
        chatTable.focus();
        screen.render();
    }
});

screen.key(["escape", "q", "C-c"], () => {
    screen.destroy();
    process.exit(0);
});

// Initial load
setTimeout(() => {
    refresh();
    updateLogs();
    setInterval(refresh, 5000);
    setInterval(updateLogs, 2000);
    chatTable.focus();
    screen.render();
}, 500);
