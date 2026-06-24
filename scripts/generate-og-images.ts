import { mkdir, readFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const pagesRoot = "src/pages";
const outputRoot = "dist/og";

const escapeXml = (value: string) =>
  value.replace(/[<>&"']/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });

const parseYamlValue = (value: string) => {
  const trimmed = value.trim();

  if (trimmed.startsWith('"')) {
    return JSON.parse(trimmed);
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replaceAll("''", "'");
  }

  return trimmed;
};

const readFrontmatter = (source: string) => {
  const block = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!block) return undefined;

  const get = (key: string) => {
    const match = block[1].match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match ? parseYamlValue(match[1]) : undefined;
  };

  const title = get("title");
  const date = get("date");
  return title && date ? { title, date } : undefined;
};

const characterWidth = (character: string) => {
  if (/\s/.test(character)) return 0.32;
  if (/[\x00-\xff]/.test(character)) return 0.56;
  return 1;
};

const wrapTitle = (title: string, maxWidth = 15.5) => {
  const lines: string[] = [];
  let line = "";
  let width = 0;

  for (const character of title) {
    const nextWidth = characterWidth(character);
    if (line && width + nextWidth > maxWidth) {
      lines.push(line.trim());
      line = "";
      width = 0;
    }
    line += character;
    width += nextWidth;
  }

  if (line) lines.push(line.trim());
  if (lines.length <= 3) return lines;

  return [...lines.slice(0, 2), `${lines.slice(2).join("").slice(0, 14)}…`];
};

const renderImage = async (
  title: string,
  rawDate: string | undefined,
  outputPath: string,
) => {
  const footer = rawDate
    ? `開催日  ${new Intl.DateTimeFormat("ja-JP", {
        timeZone: "UTC",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(rawDate))}`
    : "TID Linux Circle";
  const lines = wrapTitle(title);
  const titleStartY = lines.length === 1 ? 310 : lines.length === 2 ? 266 : 222;
  const font = await readFile(
    "node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-700-normal.woff2",
  );
  const latinFont = await readFile(
    "node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-latin-700-normal.woff2",
  );
  const fontCss = [font, latinFont]
    .map(
      (file) => `@font-face {
        font-family: "OGP Noto Sans JP";
        font-weight: 700;
        src: url(data:font/woff2;base64,${file.toString("base64")}) format("woff2");
      }`,
    )
    .join("\n");
  const titleElements = lines
    .map(
      (line, index) =>
        `<text x="96" y="${titleStartY + index * 88}" class="title">${escapeXml(line)}</text>`,
    )
    .join("\n");
  const svg = `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <style>
        ${fontCss}
        text { font-family: "OGP Noto Sans JP", sans-serif; font-weight: 700; }
        .title { fill: #17201c; font-size: 68px; letter-spacing: 0.01em; }
        .label { fill: #26734a; font-size: 26px; letter-spacing: 0.08em; }
        .date { fill: #56605b; font-size: 30px; }
      </style>
      <rect width="1200" height="630" fill="#f7f8f6" />
      <rect x="0" y="0" width="16" height="630" fill="#35a568" />
      <text x="96" y="105" class="label">TID LINUX CIRCLE</text>
      ${titleElements}
      <line x1="96" y1="522" x2="1104" y2="522" stroke="#d7dcd9" />
      <text x="96" y="578" class="date">${escapeXml(footer)}</text>
    </svg>`;

  await mkdir(dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
};

const glob = new Bun.Glob(`${pagesRoot}/**/*.md`);
let generated = 0;

for await (const markdownPath of glob.scan({ onlyFiles: true })) {
  const frontmatter = readFrontmatter(await readFile(markdownPath, "utf8"));
  if (!frontmatter) {
    console.warn(
      `Skipping ${markdownPath}: title and date frontmatter are required.`,
    );
    continue;
  }

  const pagePath =
    relative(pagesRoot, markdownPath)
      .replace(/\.md$/, "")
      .replace(/(?:^|\/)index$/, "") || "index";
  const outputPath = `${outputRoot}/${pagePath}.png`;
  await renderImage(frontmatter.title, frontmatter.date, outputPath);
  console.log(`Generated ${outputPath}`);
  generated += 1;
}

await renderImage(
  "TID Linuxサークル カンファレンス掲示板",
  undefined,
  `${outputRoot}/index.png`,
);
console.log(`Generated ${outputRoot}/index.png`);

console.log(
  `Generated ${generated} article OGP image${generated === 1 ? "" : "s"}.`,
);
