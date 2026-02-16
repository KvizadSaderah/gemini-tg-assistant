import blessed from "blessed";
import contrib from "blessed-contrib";
import logger from "./logger.js";

export function createDashboard() {
  try {
    const screen = blessed.screen({ smartCSR: true, title: "Gemini Bot Dashboard" });
    const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

    const logBox = grid.set(0, 0, 8, 12, contrib.log, {
      fg: "green",
      label: "Application Logs",
    });

    const statusBox = grid.set(8, 0, 4, 6, contrib.table, {
      keys: true,
      fg: "white",
      label: "Bot Status",
      columnSpacing: 1,
      columnWidth: [15, 15],
    });

    const statsBox = grid.set(8, 6, 4, 6, contrib.donut, {
      label: "Stats",
      radius: 8,
      arcWidth: 3,
      remainColor: "black",
    });

    let messageCount = 0;
    let imageCount = 0;

    const updateStatus = (status: string) => {
      try {
        statusBox.setData({
          headers: ["Metric", "Value"],
          data: [
            ["Status", status],
            ["Uptime", Math.floor(process.uptime()) + "s"],
            ["Messages", messageCount.toString()],
            ["Images", imageCount.toString()],
          ],
        });
        screen.render();
      } catch (e) {}
    };

    // Safe log wrapper
    const originalInfo = logger.info.bind(logger);
    logger.info = (msg: any, ...meta: any[]) => {
      try { logBox.log(typeof msg === 'string' ? msg : JSON.stringify(msg)); } catch(e) {}
      return originalInfo(msg, ...meta);
    };

    screen.key(["escape", "q", "C-c"], () => {
        screen.destroy();
        process.exit(0);
    });

    return {
      updateStatus,
      incrementMessages: () => { 
          messageCount++; 
          updateStatus("Active");
      },
      incrementImages: () => { 
          imageCount++; 
          updateStatus("Active");
      },
      render: () => screen.render()
    };
  } catch (err) {
    console.error("Dashboard failed to start, falling back to console:", err);
    return {
      updateStatus: (s: string) => logger.info(`Status: ${s}`),
      incrementMessages: () => {},
      incrementImages: () => {},
      render: () => {}
    };
  }
}
