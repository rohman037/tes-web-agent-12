const fs = require('fs');

const text = `
- **Rincian Adegan Video & Prompt AI per Segmen (10 Detik)**:
  - **[00:00 - 00:05] Klip 1 (Hook)**:
    - *Aksi & Dialog/VO*: Presenter tersenyum ramah.
    - *Prompt AI Video*:
\`\`\`text
[Style]: Bright
\`\`\`
  - **[00:05 - 00:10] Klip 2**:
    - *Aksi & Dialog/VO*: Presenter menampilkan detail produk.
    - *Prompt AI Video*:
\`\`\`text
[Style]: Clean
\`\`\`
- **AEO Caption SEO**:
`;

const clipRegex = /(?:^|\n)\s*-\s*\*\*\[(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})\]\s*([^\*:]+)\*\*:?([\s\S]*?)(?=(?:\n\s*-\s*\*\*\[\d{2}:\d{2}|$))/gi;

let match;
while ((match = clipRegex.exec(text)) !== null) {
  console.log("MATCH 1", match[1]);
  console.log("MATCH 2", match[2]);
  console.log("MATCH 3 length", match[3].length);
  
  const contentBlock = match[3];
  const actMatch = contentBlock.match(/(?:\*Aksi & Dialog\/VO\*|\*Aksi & VO\*|\*Aksi\*):\s*([\s\S]*?)(?=(?:\n\s*-\s*\*Prompt AI Video\*|\n\s*-\s*\*Prompt|```|\[Style\]:|$))/i);
  console.log("ACTION MATCH:", actMatch ? actMatch[1].trim() : "NOT FOUND");
}
