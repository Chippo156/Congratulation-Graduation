import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connectDatabase } from "./database.js";

const defaultSource = fileURLToPath(new URL("../data/wishes.sqlite", import.meta.url));
let pool;
let connection;
try {
  // Nguồn chỉ đọc: không sửa hoặc xóa database SQLite cũ.
  const source = new DatabaseSync(resolve(process.argv[2] || defaultSource), { readOnly: true });
  let wishes;
  try {
    wishes = source.prepare("SELECT id, name, message, created_at AS createdAt FROM wishes ORDER BY id").all();
  } finally {
    source.close();
  }
  pool = await connectDatabase();
  connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const [existing] = await connection.query("SELECT id, name, message, created_at AS createdAt FROM wishes ORDER BY id FOR UPDATE");
    const byId = new Map(existing.map((wish) => [wish.id, wish]));
    const alreadyImported = wishes.every((wish) => {
      const current = byId.get(wish.id);
      return current && current.name === wish.name && current.message === wish.message &&
        current.createdAt.getTime() === new Date(wish.createdAt).getTime();
    });
    if (!alreadyImported) {
      if (existing.length) {
        throw new Error("MySQL đã có lời chúc không khớp dữ liệu nguồn. Dừng chuyển để tránh ghi đè; SQLite vẫn được giữ nguyên.");
      }
      for (const wish of wishes) {
        await connection.execute(
          "INSERT INTO wishes (id, name, message, created_at) VALUES (?, ?, ?, ?)",
          [wish.id, wish.name, wish.message, new Date(wish.createdAt)],
        );
      }
    }
    await connection.commit();
    console.log(alreadyImported
      ? `Đã kiểm tra: ${wishes.length} lời chúc nguồn đã có trong MySQL, không tạo bản trùng.`
      : `Đã chuyển ${wishes.length} lời chúc sang MySQL, giữ nguyên ID và thời gian gửi.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  }
} catch (error) {
  console.error("Không thể chuyển lời chúc:", error.code || error.message);
  process.exitCode = 1;
} finally {
  connection?.release();
  await pool?.end();
}
