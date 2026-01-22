// scripts/encode-image.mjs
import fs from "fs";
import path from "path";

const filePath = path.resolve("public", "brasao.jpg"); // ajuste se o nome for outro
const buf = fs.readFileSync(filePath);
const base64 = buf.toString("base64");

// PNG:
const dataUrl = `data:image/jpeg;base64,${base64}`;

console.log(dataUrl);
