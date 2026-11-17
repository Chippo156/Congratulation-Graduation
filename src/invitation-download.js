import { event, dateParts } from "./event";

// Vẽ ở kích thước gấp đôi để ảnh lưu về vẫn sắc nét khi in hoặc chia sẻ.
export async function downloadInvitation(guestName = "") {
  await Promise.all([
    document.fonts.load('600 48px "Noto Serif"'),
    document.fonts.load('italic 48px "Noto Serif"'),
    document.fonts.load('400 24px "Be Vietnam Pro"'),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = 2000;
  canvas.height = 2800;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ tạo ảnh thiệp.");
  ctx.scale(2, 2);
  const gold = "#ddc287", ivory = "#fff8e9", navy = "#112b41";
  const serif = '"Noto Serif", Georgia, serif';
  const sans = '"Be Vietnam Pro", Arial, sans-serif';

  function text(value, x, y, size, color = gold, style = "400", family = sans) {
    ctx.font = `${style} ${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(value, x, y);
  }
  function lines(value, width) {
    const result = [];
    let line = "";
    for (const word of value.trim().split(/\s+/)) {
      if (line && ctx.measureText(`${line} ${word}`).width > width) {
        result.push(line);
        line = "";
      }
      for (const character of (line ? " " : "") + word) {
        if (ctx.measureText(line + character).width > width && line) {
          result.push(line);
          line = "";
        }
        line += character;
      }
    }
    if (line) result.push(line);
    return result;
  }
  function block(value, y, width, size, maxLines, color, style = "400", family = serif) {
    let rows;
    do {
      ctx.font = `${style} ${size}px ${family}`;
      rows = lines(value, width);
      if (rows.length <= maxLines) break;
      size -= 1;
    } while (size >= 10);
    if (rows.length > maxLines) throw new Error("Tên người nhận quá dài để đặt lên thiệp. Hãy rút gọn tên trong liên kết mời.");
    rows.forEach((row, index) => text(row, 500, y + index * size * 1.4, size, color, style, family));
  }
  function line(x1, y1, x2, y2, color = gold, width = 1) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function diamond(x, y, radius = 4) {
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius, y);
    ctx.lineTo(x, y + radius);
    ctx.lineTo(x - radius, y);
    ctx.closePath();
    ctx.fillStyle = gold;
    ctx.fill();
  }

  const background = ctx.createLinearGradient(0, 0, 1000, 1400);
  background.addColorStop(0, "#173e54");
  background.addColorStop(0.55, "#10283d");
  background.addColorStop(1, "#071623");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1000, 1400);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(32, 32, 936, 1336);
  ctx.strokeStyle = "#ddc28755";
  ctx.strokeRect(42, 42, 916, 1316);
  for (const x of [58, 942]) for (const y of [58, 1342]) diamond(x, y, 5);

  // Vòm, huy hiệu và vòng nguyệt quế không phụ thuộc ảnh bên ngoài.
  ctx.beginPath();
  ctx.moveTo(120, 490);
  ctx.lineTo(120, 300);
  ctx.bezierCurveTo(120, 35, 880, 35, 880, 300);
  ctx.lineTo(880, 490);
  ctx.strokeStyle = "#ddc28733";
  ctx.stroke();
  text(`${event.schoolShort}  /  CLASS OF ${dateParts.year}`, 500, 105, 18);
  ctx.beginPath();
  ctx.arc(500, 220, 66, 0, Math.PI * 2);
  ctx.strokeStyle = gold;
  ctx.stroke();
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * 1.6 - 0.65;
      const x = 500 + side * (91 - i * 4);
      const y = 175 + i * 16;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(side * angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 11, 0, 0, Math.PI * 2);
      ctx.fillStyle = gold;
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.beginPath();
  ctx.moveTo(454, 211);
  ctx.lineTo(500, 190);
  ctx.lineTo(546, 211);
  ctx.lineTo(500, 233);
  ctx.closePath();
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(472, 228);
  ctx.quadraticCurveTo(500, 253, 528, 228);
  ctx.lineTo(528, 242);
  ctx.quadraticCurveTo(500, 265, 472, 242);
  ctx.closePath();
  ctx.fill();
  line(543, 214, 543, 246, gold, 2);
  diamond(543, 250, 3);

  text("THIỆP MỜI LỄ TỐT NGHIỆP", 500, 337, 19);
  text("Một hành trình mới", 500, 403, 47, ivory, "italic", serif);
  line(400, 438, 480, 438, "#ddc28788");
  diamond(500, 438);
  line(520, 438, 600, 438, "#ddc28788");
  text("TRÂN TRỌNG KÍNH MỜI", 500, 489, 15);
  block(guestName || "Bạn thân mến", 545, 760, 43, 2, ivory, "600");
  text("Đến chung vui và lưu giữ khoảnh khắc đặc biệt cùng", 500, 643, 17, "#d4dfdf");

  ctx.save();
  ctx.shadowColor = "#00000045";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = ivory;
  ctx.beginPath();
  ctx.roundRect(90, 690, 820, 586, 6);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#b4965d80";
  ctx.strokeRect(106, 706, 788, 554);
  text("TÂN " + event.degree.toLocaleUpperCase("vi-VN"), 500, 754, 14, "#8a6c34");
  block(event.name, 815, 700, 40, 2, navy, "600");
  text(`NIÊN KHÓA ${event.cohort}`, 500, 900, 14, "#8a6c34");
  line(177, 927, 823, 927, "#b4965d66");
  text(dateParts.day, 310, 1002, 56, navy, "600", serif);
  text(`THÁNG ${dateParts.month} · ${dateParts.year}`, 310, 1034, 13, "#8a6c34");
  line(465, 952, 465, 1048, "#b4965d66");
  text(dateParts.time, 650, 992, 29, navy, "600", serif);
  text(`${dateParts.weekday.toLocaleUpperCase("vi-VN")} · GIỜ VIỆT NAM`, 650, 1024, 12, "#8a6c34");
  line(177, 1071, 823, 1071, "#b4965d66");
  block([event.venue, event.school].filter(Boolean).join(" · "), 1115, 690, 23, 2, navy, "600");
  block(event.address, 1190, 675, 16, 2, "#5b605e", "400", sans);
  text("Sự hiện diện của bạn là niềm vinh hạnh của mình.", 500, 1322, 18, gold, "italic", serif);

  const blob = await new Promise((resolve, reject) => canvas.toBlob(
    (value) => value ? resolve(value) : reject(new Error("Chưa tạo được ảnh thiệp. Bạn thử lại nhé.")),
    "image/png",
  ));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "thiep-moi-tot-nghiep.png";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
