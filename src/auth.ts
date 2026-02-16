import fs from "fs";
import logger from "./logger.js";
import * as dotenv from "dotenv";

dotenv.config();

const AUTH_FILE = "authorized_users.json";

interface UserData {
  id?: number;
  username?: string;
}

class AuthManager {
  private allowedUsers: UserData[] = [];

  constructor() {
    this.load();
  }

  private load() {
    if (fs.existsSync(AUTH_FILE)) {
      const data = fs.readFileSync(AUTH_FILE, "utf-8");
      this.allowedUsers = JSON.parse(data);
      logger.info(`Loaded ${this.allowedUsers.length} users from cache file`);
    }
    
    const envRaw = process.env.ALLOWED_USERS || "";
    logger.info(`Raw ALLOWED_USERS from .env: "${envRaw}"`);
    
    const envUsers = envRaw.split(",").map(u => u.trim()).filter(u => u);
    
    envUsers.forEach(u => {
      const isId = !isNaN(parseInt(u)) && !u.startsWith("@");
      const cleanName = u.replace("@", "").toLowerCase();
      
      const exists = this.allowedUsers.find(au => 
        isId ? au.id === parseInt(u) : au.username?.toLowerCase() === cleanName
      );
      
      if (!exists) {
        if (isId) this.allowedUsers.push({ id: parseInt(u) });
        else this.allowedUsers.push({ username: cleanName });
        logger.info(`Added user ${u} from .env to memory`);
      }
    });
    this.save();
  }

  private save() {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(this.allowedUsers, null, 2));
  }

  isAuthorized(userId: number, username?: string): boolean {
    const cleanUsername = username ? username.replace("@", "").toLowerCase() : null;
    
    const user = this.allowedUsers.find(u => {
      if (u.id === userId) return true;
      if (cleanUsername && u.username && u.username.toLowerCase() === cleanUsername) return true;
      return false;
    });

    if (user && !user.id && userId) {
      user.id = userId;
      this.save();
      logger.info(`Successfully associated ID ${userId} with username @${username}`);
    }

    if (user) return true;

    logger.warn(`Auth failed for ID: ${userId}, Username: ${username}. Allowed: ${JSON.stringify(this.allowedUsers)}`);
    return false;
  }
}

export const authManager = new AuthManager();
