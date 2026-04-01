import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportDashboardToPdf(element: HTMLElement, title: string) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  const pdfWidth = 210; // A4 width in mm
  const pdfPageHeight = 297; // A4 height in mm
  const margin = 10;
  const contentWidth = pdfWidth - margin * 2;
  const ratio = contentWidth / imgWidth;
  const scaledHeight = imgHeight * ratio;

  const pdf = new jsPDF('p', 'mm', 'a4');
  let position = margin;
  let remainingHeight = scaledHeight;
  const pageContentHeight = pdfPageHeight - margin * 2;

  // Add title on first page
  pdf.setFontSize(14);
  pdf.setTextColor(60, 60, 60);
  pdf.text(title, margin, margin + 5);
  pdf.setFontSize(9);
  pdf.setTextColor(130, 130, 130);
  pdf.text(`Generado: ${new Date().toLocaleString('es-GT')}`, margin, margin + 11);
  
  const titleOffset = 16;
  position = margin + titleOffset;
  const firstPageContent = pageContentHeight - titleOffset;

  if (remainingHeight <= firstPageContent) {
    pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, scaledHeight);
  } else {
    let srcY = 0;
    let availableHeight = firstPageContent;
    let isFirstPage = true;

    while (remainingHeight > 0) {
      const sliceHeight = Math.min(availableHeight, remainingHeight);
      const srcSliceHeight = sliceHeight / ratio;

      // Create a temporary canvas for this slice
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = imgWidth;
      sliceCanvas.height = srcSliceHeight;
      const ctx = sliceCanvas.getContext('2d')!;
      ctx.drawImage(canvas, 0, srcY, imgWidth, srcSliceHeight, 0, 0, imgWidth, srcSliceHeight);

      const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
      const yPos = isFirstPage ? position : margin;
      pdf.addImage(sliceData, 'JPEG', margin, yPos, contentWidth, sliceHeight);

      srcY += srcSliceHeight;
      remainingHeight -= sliceHeight;

      if (remainingHeight > 0) {
        pdf.addPage();
        availableHeight = pageContentHeight;
        isFirstPage = false;
      }
    }
  }

  pdf.save(`${title.replace(/\s+/g, '_')}.pdf`);
}
