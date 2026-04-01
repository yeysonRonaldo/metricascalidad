import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportDashboardToPdf(element: HTMLElement, title: string) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = 210;
  const pdfPageHeight = 297;
  const margin = 10;
  const contentWidth = pdfWidth - margin * 2;

  // Add title on first page
  pdf.setFontSize(14);
  pdf.setTextColor(60, 60, 60);
  pdf.text(title, margin, margin + 5);
  pdf.setFontSize(9);
  pdf.setTextColor(130, 130, 130);
  pdf.text(`Generado: ${new Date().toLocaleString('es-GT')}`, margin, margin + 11);

  // Collect all chart blocks and other sections
  const blocks = collectBlocks(element);

  let currentY = margin + 16;

  for (const block of blocks) {
    const canvas = await html2canvas(block, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const ratio = contentWidth / canvas.width;
    const blockHeight = canvas.height * ratio;

    // If this block doesn't fit on current page, start a new page
    if (currentY + blockHeight > pdfPageHeight - margin && currentY > margin + 20) {
      pdf.addPage();
      currentY = margin;
    }

    // If single block is taller than a full page, scale it down to fit
    if (blockHeight > pdfPageHeight - margin * 2) {
      const scale = (pdfPageHeight - margin * 2) / blockHeight;
      const scaledWidth = contentWidth * scale;
      const scaledHeight = blockHeight * scale;
      const xOffset = margin + (contentWidth - scaledWidth) / 2;
      pdf.addImage(imgData, 'JPEG', xOffset, currentY, scaledWidth, scaledHeight);
      currentY += scaledHeight + 4;
    } else {
      pdf.addImage(imgData, 'JPEG', margin, currentY, contentWidth, blockHeight);
      currentY += blockHeight + 4;
    }
  }

  pdf.save(`${title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '_')}.pdf`);
}

function collectBlocks(container: HTMLElement): HTMLElement[] {
  const blocks: HTMLElement[] = [];

  // First try to get .chart-block elements (individual charts)
  const chartBlocks = container.querySelectorAll<HTMLElement>('.chart-block');
  
  if (chartBlocks.length > 0) {
    // Also collect non-chart-block direct children (like KPI cards, headers, grids)
    const children = Array.from(container.children) as HTMLElement[];
    
    for (const child of children) {
      if (child.classList.contains('chart-block')) {
        blocks.push(child);
      } else {
        // Check if this element contains chart-blocks inside
        const innerCharts = child.querySelectorAll<HTMLElement>('.chart-block');
        if (innerCharts.length > 0) {
          // Add non-chart siblings and then charts separately
          innerCharts.forEach(c => blocks.push(c));
        } else {
          // It's a non-chart block (KPIs, section headers, grids, etc.)
          blocks.push(child);
        }
      }
    }
  } else {
    // Fallback: treat each direct child as a block
    const children = Array.from(container.children) as HTMLElement[];
    children.forEach(c => blocks.push(c));
  }

  return blocks;
}
