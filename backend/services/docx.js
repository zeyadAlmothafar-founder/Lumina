import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle,
} from 'docx';

function parseMarkdown(md) {
  return md.split('\n').map(line => {
    const t = line.trim();
    if (!t) return { type: 'empty' };
    if (t.startsWith('# ')) return { type: 'h1', text: t.slice(2) };
    if (t.startsWith('## ')) return { type: 'h2', text: t.slice(3) };
    if (t.startsWith('### ')) return { type: 'h3', text: t.slice(4) };
    if (t.startsWith('- ') || t.startsWith('* ')) return { type: 'bullet', text: t.slice(2) };
    if (/^\d+\.\s/.test(t)) return { type: 'para', text: t.replace(/^\d+\.\s/, '') };
    // Strip surrounding ** bold markers for standalone bold lines
    if (t.startsWith('**') && t.endsWith('**') && t.length > 4) {
      return { type: 'bold', text: t.slice(2, -2) };
    }
    return { type: 'para', text: t };
  });
}

function inlineRuns(text) {
  // Convert **bold** inline spans to TextRuns
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((p, i) =>
    i % 2 === 1
      ? new TextRun({ text: p, bold: true, font: 'Arial', size: 24 })
      : new TextRun({ text: p, font: 'Arial', size: 24 })
  );
}

export async function generateDocx(topic, outline) {
  const lines = parseMarkdown(outline);

  const children = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: 'Essay Outline', bold: true, size: 44, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: `Topic: ${topic}`, size: 24, font: 'Arial', color: '555555' })],
    }),
    new Paragraph({
      spacing: { after: 400 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '4F46E5', space: 4 } },
      children: [new TextRun({ text: '' })],
    }),
  ];

  for (const el of lines) {
    switch (el.type) {
      case 'empty':
        children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun('')] }));
        break;
      case 'h1':
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 320, after: 160 },
          children: [new TextRun({ text: el.text, font: 'Arial', bold: true, size: 32 })],
        }));
        break;
      case 'h2':
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text: el.text, font: 'Arial', bold: true, size: 28 })],
        }));
        break;
      case 'h3':
        children.push(new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 80 },
          children: [new TextRun({ text: el.text, font: 'Arial', bold: true, size: 26 })],
        }));
        break;
      case 'bullet':
        children.push(new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 80 },
          children: inlineRuns(el.text),
        }));
        break;
      case 'bold':
        children.push(new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: el.text, bold: true, font: 'Arial', size: 24 })],
        }));
        break;
      default:
        children.push(new Paragraph({
          spacing: { after: 120 },
          children: inlineRuns(el.text),
        }));
    }
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 24 } } },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal',
          run: { size: 32, bold: true, font: 'Arial', color: '1E1B4B' },
          paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal',
          run: { size: 28, bold: true, font: 'Arial', color: '312E81' },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal',
          run: { size: 26, bold: true, font: 'Arial', color: '4338CA' },
          paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}
