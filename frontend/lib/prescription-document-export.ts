export async function downloadPrescriptionPdfFromElement(
  element: HTMLElement,
  fileName: string
): Promise<void> {
  const html2pdfModule = await import("html2pdf.js");
  const html2pdf = html2pdfModule.default || html2pdfModule;

  await html2pdf()
    .set({
      margin: 0,
      filename: fileName,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      },
    })
    .from(element)
    .save();
}
