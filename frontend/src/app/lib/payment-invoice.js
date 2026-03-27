const PAYMENT_INVOICE_STORAGE_KEY = "eventzen.payment.invoices.v1";
const formatCurrency = (value, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value || 0);
const formatPdfCurrency = (value, currency = "INR") => {
    const amount = new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value || 0);
    if (currency.toUpperCase() === "INR") {
        return `INR ${amount}`;
    }
    return `${currency.toUpperCase()} ${amount}`;
};
const formatDate = (value) => value
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Pending";
const escapePdfText = (value) => value
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
const wrapText = (value, maxChars) => {
    const words = value.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    words.forEach((word) => {
        if (word.length > maxChars) {
            if (current) {
                lines.push(current);
                current = "";
            }
            for (let index = 0; index < word.length; index += maxChars) {
                lines.push(word.slice(index, index + maxChars));
            }
            return;
        }
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars) {
            if (current) {
                lines.push(current);
                current = word;
            }
            else {
                lines.push(word);
                current = "";
            }
        }
        else {
            current = next;
        }
    });
    if (current) {
        lines.push(current);
    }
    return lines.length > 0 ? lines : [value];
};
const rgb = (r, g, b) => `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;
const drawRect = (x, y, width, height, fill, stroke) => {
    const commands = [`q`, `${fill} rg`];
    if (stroke) {
        commands.push(`${stroke} RG`);
    }
    commands.push(`${x} ${y} ${width} ${height} re ${stroke ? "B" : "f"}`, `Q`);
    return commands;
};
const drawTextBlock = (text, x, y, size, options) => {
    const wrapped = wrapText(text, options?.maxChars || 60);
    const lines = [];
    let cursorY = y;
    wrapped.forEach((line) => {
        lines.push("BT");
        lines.push(`/${options?.font || "F1"} ${size} Tf`);
        lines.push(`${options?.color || rgb(15, 23, 42)} rg`);
        lines.push(`1 0 0 1 ${x} ${cursorY} Tm`);
        lines.push(`(${escapePdfText(line)}) Tj`);
        lines.push("ET");
        cursorY -= options?.lineGap || Math.max(16, size + 4);
    });
    return lines;
};
export const downloadPaymentInvoice = (invoice) => {
    const contentLines = [];
    const primary = rgb(79, 70, 229);
    const textDark = rgb(17, 24, 39);
    const textLight = rgb(75, 85, 99);
    const textMuted = rgb(107, 114, 128);
    const bgLight = rgb(249, 250, 251);
    const border = rgb(229, 231, 235);
    const white = rgb(255, 255, 255);
    // Background
    contentLines.push(...drawRect(0, 0, 595, 842, white));
    // Top accent bar
    contentLines.push(...drawRect(0, 830, 595, 12, primary));
    // Header Left (Logo/Brand)
    contentLines.push(...drawTextBlock("EventZen", 45, 775, 28, { font: "F2", color: primary }));
    contentLines.push(...drawTextBlock("Your Next Great Experience", 45, 755, 11, { color: textMuted }));
    // Header Right (Invoice text)
    contentLines.push(...drawTextBlock("INVOICE", 400, 775, 24, { font: "F2", color: textDark }));
    contentLines.push(...drawTextBlock(`Invoice # ${invoice.invoiceNumber}`, 400, 755, 11, { font: "F2", color: textLight }));
    contentLines.push(...drawTextBlock(`Date: ${formatDate(invoice.createdAt)}`, 400, 740, 11, { color: textLight }));
    // Divider
    contentLines.push(`q ${border} RG 45 710 505 1 re S Q`);
    // Section: Billed To / Event Details
    const sectionY = 670;
    // Left
    contentLines.push(...drawTextBlock("BILLED TO", 45, sectionY, 10, { font: "F2", color: textMuted }));
    contentLines.push(...drawTextBlock(invoice.customerName, 45, sectionY - 20, 14, { font: "F2", color: textDark }));
    contentLines.push(...drawTextBlock(invoice.customerEmail, 45, sectionY - 40, 11, { color: textLight }));
    contentLines.push(...drawTextBlock(invoice.customerPhone, 45, sectionY - 55, 11, { color: textLight }));
    // Right
    contentLines.push(...drawTextBlock("EVENT DETAILS", 300, sectionY, 10, { font: "F2", color: textMuted }));
    contentLines.push(...drawTextBlock(invoice.eventName, 300, sectionY - 20, 14, { font: "F2", color: textDark, maxChars: 35 }));
    contentLines.push(...drawTextBlock(`Ticket: ${invoice.ticketNumber || "N/A"}`, 300, sectionY - 40, 11, { color: textLight }));
    contentLines.push(...drawTextBlock("Registration ID:", 300, sectionY - 55, 11, { color: textLight }));
    contentLines.push(...drawTextBlock(invoice.registrationId || "N/A", 300, sectionY - 70, 11, { color: textLight, maxChars: 24 }));
    contentLines.push(...drawTextBlock("Payment ID:", 300, sectionY - 100, 11, { color: textLight }));
    contentLines.push(...drawTextBlock(invoice.paymentId || invoice.gatewayPaymentId || "N/A", 300, sectionY - 115, 11, { color: textLight, maxChars: 24 }));
    // Payment Summary Box
    const summaryY = 470;
    contentLines.push(...drawRect(45, summaryY, 505, 75, bgLight, border));
    contentLines.push(...drawTextBlock("Total Amount Paid", 65, summaryY + 45, 10, { font: "F2", color: textMuted }));
    contentLines.push(...drawTextBlock(formatPdfCurrency(invoice.amount, invoice.currency), 65, summaryY + 20, 24, { font: "F2", color: primary }));
    contentLines.push(...drawTextBlock("Payment Method", 250, summaryY + 45, 10, { font: "F2", color: textMuted }));
    contentLines.push(...drawTextBlock(invoice.paymentMethod || "N/A", 250, summaryY + 25, 12, { font: "F2", color: textDark }));
    contentLines.push(...drawTextBlock("Payment Date", 400, summaryY + 45, 10, { font: "F2", color: textMuted }));
    contentLines.push(...drawTextBlock(formatDate(invoice.paymentDate || invoice.createdAt), 400, summaryY + 25, 12, { font: "F2", color: textDark, maxChars: 20 }));
    // Details Table
    contentLines.push(...drawTextBlock("PAYMENT DETAILS", 45, 450, 10, { font: "F2", color: textMuted }));
    // Table Header
    contentLines.push(...drawRect(45, 415, 505, 25, bgLight));
    contentLines.push(...drawTextBlock("Description", 60, 423, 10, { font: "F2", color: textDark }));
    contentLines.push(...drawTextBlock("Value", 250, 423, 10, { font: "F2", color: textDark }));
    const detailRows = [
        ["Payment Reference", invoice.paymentReference || "N/A"],
        ["Gateway Order ID", invoice.gatewayOrderId || "N/A"],
        ["Gateway Payment ID", invoice.gatewayPaymentId || "N/A"],
        ["Payment Status", "Succeeded"]
    ];
    let rowTop = 380;
    detailRows.forEach(([label, value], index) => {
        contentLines.push(`q ${border} RG 45 ${rowTop + 15} 505 1 re S Q`);
        contentLines.push(...drawTextBlock(label, 60, rowTop, 11, { color: textLight }));
        contentLines.push(...drawTextBlock(value, 250, rowTop, 11, { font: "F2", color: textDark }));
        rowTop -= 35;
    });
    contentLines.push(`q ${border} RG 45 ${rowTop + 15} 505 1 re S Q`);
    // Footer
    contentLines.push(...drawTextBlock("Payment confirmation", 45, 124, 14, { font: "F2", color: primary }));
    contentLines.push(...drawTextBlock("Thank you for your purchase. This invoice confirms that your payment was successfully received by EventZen.", 45, 104, 10, { color: textMuted, maxChars: 88, lineGap: 13 }));
    contentLines.push(...drawTextBlock("For invoice-related support, contact support@eventzen.com with your invoice number.", 45, 76, 10, { color: textMuted, maxChars: 88, lineGap: 13 }));
    const contentStream = contentLines.join("\n");
    const objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj",
        "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj",
        `6 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [];
    objects.forEach((object) => {
        offsets.push(pdf.length);
        pdf += `${object}\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    offsets.forEach((offset) => {
        pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    const blob = new Blob([pdf], { type: "application/pdf" });
    const blobUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = `${invoice.invoiceNumber}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
};
const getStoredInvoices = () => {
    if (typeof window === "undefined") {
        return {};
    }
    const raw = window.localStorage.getItem(PAYMENT_INVOICE_STORAGE_KEY);
    if (!raw) {
        return {};
    }
    try {
        return JSON.parse(raw);
    }
    catch {
        window.localStorage.removeItem(PAYMENT_INVOICE_STORAGE_KEY);
        return {};
    }
};
export const savePaymentInvoice = (invoice) => {
    if (typeof window === "undefined") {
        return;
    }
    const registrationId = invoice.registrationId?.trim();
    if (!registrationId) {
        return;
    }
    const invoices = getStoredInvoices();
    invoices[registrationId] = invoice;
    window.localStorage.setItem(PAYMENT_INVOICE_STORAGE_KEY, JSON.stringify(invoices));
};
export const getPaymentInvoices = () => getStoredInvoices();
