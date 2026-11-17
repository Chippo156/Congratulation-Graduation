import { createApp } from "./app.js";

async function start() {
  // Chỉ nhận HTTP sau khi kết nối MySQL và chuẩn bị bảng thành công.
  const { app, close } = await createApp();
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || "0.0.0.0";
  const server = app.listen(port, host, () =>
    console.log(`Invitation ready at http://${host}:${port} (MySQL)`),
  );
  server.on("error", async (error) => {
    console.error("Cannot start invitation server:", error.code || error.message);
    await close();
    process.exitCode = 1;
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      const deadline = setTimeout(() => process.exit(1), 10_000);
      deadline.unref();
      server.close(async () => {
        try {
          await close();
          clearTimeout(deadline);
        } catch (error) {
          console.error("Cannot close MySQL:", error.code || error.name);
          process.exitCode = 1;
        }
      });
    });
  }
}

start().catch((error) => {
  console.error("Cannot connect to MySQL:", error.code || error.message);
  process.exitCode = 1;
});
