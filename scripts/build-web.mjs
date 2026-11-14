// 게임을 HTML 파일 하나로 묶는다 (코드 · 스타일 · 폰트 모두 안에 포함)
// 사용법: npm run build:web  →  dist-web/charlie-and-the-cat.html
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

execSync("npx vite build", { stdio: "inherit" });

const dist = "dist";
const assets = join(dist, "assets");
const files = readdirSync(assets);
const read = (f) => readFileSync(join(assets, f));

let css = files.filter((f) => f.endsWith(".css")).map((f) => read(f).toString()).join("\n");
// 폰트를 data URI 로 바꿔 넣는다
css = css.replace(/url\(["']?(?:\.\/|\/assets\/|\.\/assets\/)?([^"')]+\.woff2)["']?\)/g, (_, name) => {
  const base = name.split("/").pop();
  return `url(data:font/woff2;base64,${read(base).toString("base64")})`;
});
const js = files
  .filter((f) => f.endsWith(".js"))
  .map((f) => read(f).toString().replace(/<\/script/gi, "<\\/script"))
  .join("\n");

const html = readFileSync(join(dist, "index.html"), "utf8");
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, "").trim();

// 맨 앞에 제목과 스타일, 그다음 화면, 마지막에 스크립트
const out = `<title>찰리와 고양이</title>
<style>
${css}
</style>
${body}
<script type="module">
${js}
</script>
`;
mkdirSync("dist-web", { recursive: true });
writeFileSync("dist-web/charlie-and-the-cat.html", out);
console.log(`dist-web/charlie-and-the-cat.html  ${(out.length / 1024).toFixed(0)} KB`);
