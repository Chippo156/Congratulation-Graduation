import mysql from "mysql2/promise";

export function databaseOptions(env = process.env) {
  const connectionUrl = env.MYSQL_URL || env.MYSQL_PUBLIC_URL;
  if (connectionUrl) {
    let url;
    try {
      url = new URL(connectionUrl);
    } catch {
      throw new Error("MYSQL_URL phải là URL kết nối MySQL hợp lệ.");
    }
    if (url.protocol !== "mysql:" || !url.hostname || url.pathname.length < 2) {
      throw new Error("MYSQL_URL cần có dạng mysql://user:password@host:port/database.");
    }
    return { uri: connectionUrl };
  }
  if (!env.MYSQLHOST || !env.MYSQLUSER || !env.MYSQLDATABASE || env.MYSQLPASSWORD === undefined) {
    throw new Error("Thiếu cấu hình MySQL. Đặt MYSQL_URL hoặc MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE trong môi trường hoặc file .env.");
  }
  return {
    host: env.MYSQLHOST,
    port: Number(env.MYSQLPORT || 3306),
    user: env.MYSQLUSER,
    password: env.MYSQLPASSWORD,
    database: env.MYSQLDATABASE,
  };
}

export async function connectDatabase(options = databaseOptions()) {
  const pool = mysql.createPool({
    ...options,
    charset: "utf8mb4",
    timezone: "Z",
    connectionLimit: 5,
    waitForConnections: true,
    queueLimit: 50,
    connectTimeout: 10_000,
  });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS wishes (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(60) NOT NULL,
        message VARCHAR(600) NOT NULL,
        created_at DATETIME(3) NOT NULL,
        CONSTRAINT wishes_name_length CHECK (CHAR_LENGTH(name) BETWEEN 1 AND 60),
        CONSTRAINT wishes_message_length CHECK (CHAR_LENGTH(message) BETWEEN 1 AND 600)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    return pool;
  } catch (error) {
    await pool.end();
    throw error;
  }
}
