import express from "express";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connectDatabase } from "./database.js";

const root = fileURLToPath(new URL("../", import.meta.url));

export async function createApp({
  database,
  rateLimit = 5,
  rateWindow = 60_000,
} = {}) {
  const db = await connectDatabase(database);
  const select =
    "SELECT id, name, message, created_at AS createdAt FROM wishes";
  const attempts = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [ip, value] of attempts)
      if (value.expires <= now) attempts.delete(ip);
  }, rateWindow);
  cleanup.unref();

  const app = express();
  app.disable("x-powered-by");
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use("/api", express.json({ limit: "8kb" }));

  app.get("/api/wishes", async (req, res) => {
    const { limit: rawLimit = "12", before: rawBefore } = req.query;
    const validInteger = (value) =>
      typeof value === "string" &&
      /^[1-9]\d*$/.test(value) &&
      Number.isSafeInteger(Number(value));
    if (
      !validInteger(rawLimit) ||
      Number(rawLimit) > 30 ||
      (rawBefore !== undefined && !validInteger(rawBefore))
    ) {
      return res
        .status(400)
        .json({ error: "Tham số phân trang không hợp lệ." });
    }
    const limit = Number(rawLimit);
    const [rows] = await db.query(
      rawBefore === undefined
        ? `${select} ORDER BY id DESC LIMIT ?`
        : `${select} WHERE id < ? ORDER BY id DESC LIMIT ?`,
      rawBefore === undefined ? [limit + 1] : [Number(rawBefore), limit + 1],
    );
    const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM wishes");
    res.json({
      wishes: rows.slice(0, limit),
      total,
      hasMore: rows.length > limit,
    });
  });

  app.post("/api/wishes", async (req, res) => {
    if (!req.is("application/json"))
      return res.status(415).json({ error: "Vui lòng gửi dữ liệu JSON." });
    const now = Date.now();
    const ip = req.ip;
    let entry = attempts.get(ip);
    if (!entry || entry.expires <= now) {
      if (attempts.size >= 10_000)
        return res
          .status(503)
          .json({ error: "Hệ thống đang bận. Bạn thử lại sau nhé." });
      entry = { count: 0, expires: now + rateWindow };
      attempts.set(ip, entry);
    }
    if (++entry.count > rateLimit) {
      res.set("Retry-After", String(Math.ceil((entry.expires - now) / 1000)));
      return res
        .status(429)
        .json({
          error: "Bạn gửi hơi nhanh. Vui lòng chờ một phút rồi thử lại nhé.",
        });
    }
    const { name, message } = req.body || {};
    if (typeof name !== "string" || typeof message !== "string")
      return res
        .status(400)
        .json({ error: "Vui lòng nhập tên và lời chúc của bạn." });
    const cleanName = name.trim();
    const cleanMessage = message.trim();
    if (
      !cleanName ||
      cleanName.length > 60 ||
      !cleanMessage ||
      cleanMessage.length > 600
    ) {
      return res
        .status(400)
        .json({ error: "Tên cần từ 1–60 ký tự, lời chúc từ 1–600 ký tự." });
    }
    const [result] = await db.execute(
      "INSERT INTO wishes (name, message, created_at) VALUES (?, ?, ?)",
      [cleanName, cleanMessage, new Date()],
    );
    const [[wish]] = await db.execute(`${select} WHERE id = ?`, [result.insertId]);
    res.status(201).json({ wish });
  });

  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Không tìm thấy API." }),
  );
  const dist = resolve(root, "dist");
  if (existsSync(resolve(dist, "index.html"))) {
    app.use(express.static(dist, { index: false }));
    app.get("/{*path}", (req, res, next) => {
      if (req.path.includes(".")) return next();
      res.sendFile(resolve(dist, "index.html"));
    });
  }
  app.use((err, _req, res, _next) => {
    if (err.type === "entity.too.large")
      return res.status(413).json({ error: "Nội dung gửi lên quá lớn." });
    if (err.type === "entity.parse.failed")
      return res.status(400).json({ error: "Dữ liệu JSON không hợp lệ." });
    console.error("Request failed:", err.code || err.name);
    res
      .status(500)
      .json({ error: "Chưa thể lưu lời chúc. Vui lòng thử lại sau." });
  });
  return {
    app,
    close: async () => {
      clearInterval(cleanup);
      await db.end();
    },
  };
}
