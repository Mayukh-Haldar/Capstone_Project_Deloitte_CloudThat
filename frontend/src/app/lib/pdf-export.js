import jsPDF from "jspdf";
import html2canvas from "html2canvas";
// Helper to convert currency string to number
const parseCurrency = (currencyStr) => {
    return parseFloat(currencyStr.replace(/[^0-9.-]+/g, "")) || 0;
};
// Format currency for PDF (avoiding encoding issues and compact format)
const formatPdfCurrency = (value) => {
    const num = typeof value === "string" ? parseCurrency(value) : value;
    // For very large numbers, use compact notation (K, M, B)
    if (Math.abs(num) >= 10000000) {
        // 10M+
        return "Rs " + (num / 10000000).toFixed(2) + "Cr";
    }
    else if (Math.abs(num) >= 100000) {
        // 100K+
        return "Rs " + (num / 100000).toFixed(2) + "L";
    }
    else if (Math.abs(num) >= 1000) {
        // 1K+
        return "Rs " + (num / 1000).toFixed(1) + "K";
    }
    return "Rs " + num.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const copyComputedStyles = (sourceNode, targetNode) => {
    const computedStyles = window.getComputedStyle(sourceNode);
    for (const propertyName of computedStyles) {
        targetNode.setAttribute("style", `${targetNode.getAttribute("style") || ""}${propertyName}:${computedStyles.getPropertyValue(propertyName)};`);
    }
    const sourceChildren = Array.from(sourceNode.children);
    const targetChildren = Array.from(targetNode.children);
    sourceChildren.forEach((sourceChild, index) => {
        const targetChild = targetChildren[index];
        if (targetChild) {
            copyComputedStyles(sourceChild, targetChild);
        }
    });
};
const loadImage = (src) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load chart image"));
    image.src = src;
});
const rasterizeSvg = async (svgElement) => {
    const bounds = svgElement.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(bounds.width));
    const height = Math.max(1, Math.ceil(bounds.height));
    const clonedSvg = svgElement.cloneNode(true);
    copyComputedStyles(svgElement, clonedSvg);
    clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clonedSvg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    clonedSvg.setAttribute("width", String(width));
    clonedSvg.setAttribute("height", String(height));
    if (!clonedSvg.getAttribute("viewBox")) {
        clonedSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }
    const svgMarkup = new XMLSerializer().serializeToString(clonedSvg);
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    try {
        const image = await loadImage(objectUrl);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Failed to create canvas context");
        }
        const scale = 2;
        canvas.width = width * scale;
        canvas.height = height * scale;
        context.scale(scale, scale);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        return canvas;
    }
    finally {
        URL.revokeObjectURL(objectUrl);
    }
};
const captureChartCanvas = async (chartElement) => {
    const svgElement = chartElement.querySelector(".recharts-wrapper svg.recharts-surface, svg.recharts-surface");
    if (svgElement instanceof SVGSVGElement) {
        return rasterizeSvg(svgElement);
    }
    const chartBounds = chartElement.getBoundingClientRect();
    return html2canvas(chartElement, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 15000,
        removeContainer: true,
        foreignObjectRendering: true,
        width: Math.ceil(chartBounds.width),
        height: Math.ceil(chartBounds.height),
        windowWidth: Math.ceil(chartBounds.width),
        windowHeight: Math.ceil(chartBounds.height),
        onclone: (clonedDocument) => {
            const clonedChart = clonedDocument.querySelector(`[data-chart="${chartElement.dataset.chart}"]`);
            if (clonedChart) {
                clonedChart.style.backgroundColor = "#ffffff";
                clonedChart.style.overflow = "visible";
            }
        }
    });
};
export async function exportReportsToPDF(portalType, summary, registrationChartRef, revenueChartRef, reportData) {
    // eslint-disable-next-line new-cap
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;
    const primaryColor = { r: 17, g: 50, b: 212 }; // #1132d4
    // Helper function to add new page if needed
    const checkPageBreak = (requiredSpace) => {
        if (yPosition + requiredSpace > pageHeight - margin - 20) {
            pdf.addPage();
            yPosition = margin;
            return true;
        }
        return false;
    };
    const startNewSectionPage = () => {
        pdf.addPage();
        yPosition = margin;
    };
    // ====================
    // HEADER SECTION
    // ====================
    pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.rect(0, 0, pageWidth, 55, "F");
    // EventZen Logo
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(36);
    pdf.setFont("helvetica", "bold");
    pdf.text("EventZen", margin, 28);
    // Subtitle
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${portalType} Reports Dashboard`, margin, 40);
    // Generation Date - right aligned
    pdf.setFontSize(9);
    const generatedDate = new Date().toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });
    pdf.text(generatedDate, pageWidth - margin, 40, { align: "right" });
    yPosition = 70;
    // ====================
    // EXECUTIVE SUMMARY
    // ====================
    pdf.setTextColor(30, 30, 30);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("Executive Summary", margin, yPosition);
    // Underline
    pdf.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.setLineWidth(1);
    pdf.line(margin, yPosition + 2, margin + 70, yPosition + 2);
    yPosition += 15;
    // Summary Cards in 2x2 grid
    const cardWidth = (contentWidth - 8) / 2;
    const cardHeight = 30;
    const cardSpacing = 8;
    const cards = [
        { label: "Total Events", value: summary.events.toString(), color: { r: 52, g: 152, b: 219 } },
        { label: "Total Revenue", value: formatPdfCurrency(summary.revenue), color: { r: 46, g: 204, b: 113 } },
        { label: "Total Expenses", value: formatPdfCurrency(summary.expenses), color: { r: 231, g: 76, b: 60 } },
        { label: "Net Profit", value: formatPdfCurrency(summary.profit), color: { r: 155, g: 89, b: 182 } }
    ];
    cards.forEach((card, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const x = margin + col * (cardWidth + cardSpacing);
        const y = yPosition + row * (cardHeight + cardSpacing);
        // Card shadow
        pdf.setFillColor(220, 220, 220);
        pdf.roundedRect(x + 1.5, y + 1.5, cardWidth, cardHeight, 4, 4, "F");
        // Card background
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(230, 230, 230);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 4, 4, "FD");
        // Colored left border
        pdf.setFillColor(card.color.r, card.color.g, card.color.b);
        pdf.rect(x + 2, y + 2, 3, cardHeight - 4, "F");
        // Label
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(100, 100, 100);
        pdf.text(card.label, x + 10, y + 12);
        // Value
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 30, 30);
        // Adjust font size if value is too long
        const valueStr = card.value;
        if (valueStr.length > 18) {
            pdf.setFontSize(13);
        }
        pdf.text(valueStr, x + 10, y + 24);
    });
    yPosition += (cardHeight * 2 + cardSpacing + 20);
    // ====================
    // PERFORMANCE CHARTS
    // ====================
    if (registrationChartRef && revenueChartRef) {
        startNewSectionPage();
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 30, 30);
        pdf.text("Performance Analytics", margin, yPosition);
        // Underline
        pdf.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
        pdf.setLineWidth(1);
        pdf.line(margin, yPosition + 2, margin + 70, yPosition + 2);
        yPosition += 15;
        let chartsRendered = false;
        try {
            // Wait to ensure charts are fully rendered
            await new Promise(resolve => setTimeout(resolve, 600));
            const chartSnapshots = [
                { title: "Registrations Trend", element: registrationChartRef },
                { title: "Revenue Overview", element: revenueChartRef }
            ];
            for (const chartSnapshot of chartSnapshots) {
                if (!chartSnapshot.element) {
                    continue;
                }
                try {
                    const canvas = await captureChartCanvas(chartSnapshot.element);
                    if (canvas && canvas.width > 0 && canvas.height > 0) {
                        const chartTitleHeight = 7;
                        const chartSpacing = 12;
                        const chartPadding = 2;
                        const chartRatio = canvas.height / canvas.width;
                        const renderedHeight = Math.min(contentWidth * chartRatio, 90);
                        const sectionHeight = chartTitleHeight + renderedHeight + chartSpacing;
                        checkPageBreak(sectionHeight);
                        pdf.setFontSize(11);
                        pdf.setFont("helvetica", "bold");
                        pdf.setTextColor(30, 30, 30);
                        pdf.text(chartSnapshot.title, margin, yPosition);
                        pdf.setDrawColor(200, 200, 200);
                        pdf.setLineWidth(0.5);
                        pdf.rect(margin, yPosition + 3, contentWidth, renderedHeight + chartPadding * 2, "S");
                        pdf.addImage(canvas.toDataURL("image/png", 1.0), "PNG", margin + chartPadding, yPosition + 5, contentWidth - chartPadding * 2, renderedHeight);
                        yPosition += sectionHeight;
                        chartsRendered = true;
                    }
                }
                catch (err) {
                    console.error(`Failed to capture ${chartSnapshot.title}:`, err);
                }
            }
            if (!chartsRendered) {
                pdf.setFontSize(10);
                pdf.setTextColor(150, 150, 150);
                pdf.setFont("helvetica", "italic");
                pdf.text("Charts visualization - view in dashboard for interactive charts", margin, yPosition + 35);
                yPosition += 50;
            }
            else {
                yPosition += 4;
            }
        }
        catch (error) {
            console.error("Error in chart capture:", error);
            pdf.setFontSize(10);
            pdf.setTextColor(150, 150, 150);
            pdf.setFont("helvetica", "italic");
            pdf.text("Charts visualization - view in dashboard for interactive charts", margin, yPosition + 35);
            yPosition += 50;
        }
    }
    // ====================
    // FINANCIAL REPORT TABLE
    // ====================
    startNewSectionPage();
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(30, 30, 30);
    pdf.text("Detailed Financial Report", margin, yPosition);
    // Underline
    pdf.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
    pdf.setLineWidth(1);
    pdf.line(margin, yPosition + 2, margin + 70, yPosition + 2);
    yPosition += 15;
    if (reportData.length === 0) {
        pdf.setFontSize(11);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(120, 120, 120);
        pdf.text("No financial data available for the selected period.", margin, yPosition);
        yPosition += 15;
    }
    else {
        // Table setup
        const rowHeight = 14;
        const headerHeight = 11;
        // Column widths (total = 162mm, fits in 170mm contentWidth with margin)
        const colWidths = {
            event: 52,
            revenue: 32,
            expenses: 30,
            profit: 30,
            txns: 18
        };
        // Table header
        pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
        pdf.rect(margin, yPosition, contentWidth, headerHeight, "F");
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        let xPos = margin + 3;
        pdf.text("Event", xPos, yPosition + 7.5);
        xPos += colWidths.event;
        pdf.text("Revenue", xPos, yPosition + 7.5);
        xPos += colWidths.revenue;
        pdf.text("Expenses", xPos, yPosition + 7.5);
        xPos += colWidths.expenses;
        pdf.text("Net Profit", xPos, yPosition + 7.5);
        xPos += colWidths.profit;
        pdf.text("Txns", xPos, yPosition + 7.5);
        yPosition += headerHeight;
        // Table rows
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        reportData.forEach((row, idx) => {
            // Check for page break
            if (checkPageBreak(rowHeight + 10)) {
                // Redraw header on new page
                pdf.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
                pdf.rect(margin, yPosition, contentWidth, headerHeight, "F");
                pdf.setFontSize(10);
                pdf.setFont("helvetica", "bold");
                pdf.setTextColor(255, 255, 255);
                xPos = margin + 3;
                pdf.text("Event", xPos, yPosition + 7.5);
                xPos += colWidths.event;
                pdf.text("Revenue", xPos, yPosition + 7.5);
                xPos += colWidths.revenue;
                pdf.text("Expenses", xPos, yPosition + 7.5);
                xPos += colWidths.expenses;
                pdf.text("Net Profit", xPos, yPosition + 7.5);
                xPos += colWidths.profit;
                pdf.text("Txns", xPos, yPosition + 7.5);
                yPosition += headerHeight;
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(9);
            }
            // Alternate row background
            if (idx % 2 === 0) {
                pdf.setFillColor(249, 250, 251);
                pdf.rect(margin, yPosition, contentWidth, rowHeight, "F");
            }
            // Row content
            xPos = margin + 3;
            pdf.setTextColor(30, 30, 30);
            // Event name
            pdf.setFont("helvetica", "bold");
            const eventName = row.eventName.length > 28 ? row.eventName.substring(0, 26) + "..." : row.eventName;
            pdf.text(eventName, xPos, yPosition + 6);
            // Event ID
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(7.5);
            pdf.setTextColor(120, 120, 120);
            const eventId = row.eventId.length > 34 ? row.eventId.substring(0, 32) + "..." : row.eventId;
            pdf.text(eventId, xPos, yPosition + 11);
            pdf.setFontSize(9);
            pdf.setTextColor(30, 30, 30);
            xPos += colWidths.event;
            // Revenue (smaller font to fit)
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(8.5);
            pdf.text(formatPdfCurrency(row.revenue), xPos, yPosition + 8.5);
            xPos += colWidths.revenue;
            // Expenses
            pdf.text(formatPdfCurrency(row.expenses), xPos, yPosition + 8.5);
            xPos += colWidths.expenses;
            // Net Profit (colored)
            const profitValue = parseCurrency(row.profit);
            if (profitValue >= 0) {
                pdf.setTextColor(39, 174, 96); // Green
            }
            else {
                pdf.setTextColor(231, 76, 60); // Red
            }
            pdf.setFont("helvetica", "bold");
            pdf.text(formatPdfCurrency(row.profit), xPos, yPosition + 8.5);
            pdf.setTextColor(30, 30, 30);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            xPos += colWidths.profit;
            // Transactions
            pdf.text(row.transactions.toString(), xPos, yPosition + 8.5);
            // Bottom border
            pdf.setDrawColor(235, 235, 235);
            pdf.setLineWidth(0.2);
            pdf.line(margin, yPosition + rowHeight, margin + contentWidth, yPosition + rowHeight);
            yPosition += rowHeight;
        });
        // Table border
        pdf.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
        pdf.setLineWidth(1);
        pdf.line(margin, yPosition, margin + contentWidth, yPosition);
        yPosition += 8;
        // Summary totals
        const totalRevenue = reportData.reduce((sum, row) => sum + parseCurrency(row.revenue), 0);
        const totalExpenses = reportData.reduce((sum, row) => sum + parseCurrency(row.expenses), 0);
        const totalProfit = reportData.reduce((sum, row) => sum + parseCurrency(row.profit), 0);
        pdf.setFillColor(240, 243, 248);
        pdf.rect(margin, yPosition, contentWidth, 16, "F");
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(30, 30, 30);
        pdf.text("GRAND TOTAL", margin + 3, yPosition + 11);
        xPos = margin + colWidths.event + 3;
        pdf.setFontSize(9.5);
        pdf.text(formatPdfCurrency(totalRevenue), xPos, yPosition + 11);
        xPos += colWidths.revenue;
        pdf.text(formatPdfCurrency(totalExpenses), xPos, yPosition + 11);
        xPos += colWidths.expenses;
        if (totalProfit >= 0) {
            pdf.setTextColor(39, 174, 96);
        }
        else {
            pdf.setTextColor(231, 76, 60);
        }
        pdf.text(formatPdfCurrency(totalProfit), xPos, yPosition + 11);
        yPosition += 20;
    }
    // ====================
    // FOOTER ON ALL PAGES
    // ====================
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        // Footer divider line
        const footerY = pageHeight - 18;
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.5);
        pdf.line(margin, footerY, pageWidth - margin, footerY);
        // Footer text
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.setFont("helvetica", "normal");
        // Left: Company tagline
        pdf.text("EventZen - Professional Event Management Platform", margin, footerY + 7);
        // Center: Confidential notice
        pdf.setFont("helvetica", "italic");
        pdf.text("Confidential & Proprietary", pageWidth / 2, footerY + 7, { align: "center" });
        // Right: Page number
        pdf.setFont("helvetica", "normal");
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth - margin, footerY + 7, { align: "right" });
    }
    // ====================
    // SAVE PDF
    // ====================
    const fileName = `EventZen_${portalType}_Report_${new Date().toISOString().split("T")[0]}.pdf`;
    pdf.save(fileName);
}
