import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'e2e',timeout:60000,workers:1,
 use:{baseURL:'http://127.0.0.1:5173',viewport:{width:1440,height:1000},headless:true},
 webServer:{command:'npx vite --host 127.0.0.1 --port 5173',url:'http://127.0.0.1:5173',reuseExistingServer:true,timeout:30000}
});
