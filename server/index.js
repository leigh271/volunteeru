import { createPlatform } from "./platform.js";
const { server } = createPlatform({
  databasePath: process.env.DATABASE_PATH || "server/data/volunteeru.sqlite",
  secureCookie:
    process.env.SECURE_COOKIE === "true" ||
    process.env.NODE_ENV === "production",
});
const port = Number(process.env.PORT || 3001);
server.listen(port, "127.0.0.1", () =>
  console.log(`VolunteerU authenticated API: http://127.0.0.1:${port}`),
);
