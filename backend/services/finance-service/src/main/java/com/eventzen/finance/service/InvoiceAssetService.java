package com.eventzen.finance.service;

import com.eventzen.finance.config.StorageProperties;
import com.eventzen.finance.model.Payment;
import io.minio.BucketExistsArgs;
import io.minio.GetObjectArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.io.InputStream;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class InvoiceAssetService {

    private static final Logger log = LoggerFactory.getLogger(InvoiceAssetService.class);

    private final StorageProperties storageProperties;
    private final MinioClient minioClient;

    public InvoiceAssetService(StorageProperties storageProperties) {
        this.storageProperties = storageProperties;
        this.minioClient = storageProperties.enabled() && StringUtils.hasText(storageProperties.endpoint())
                ? MinioClient.builder()
                        .endpoint(storageProperties.endpoint())
                        .credentials(storageProperties.accessKey(), storageProperties.secretKey())
                        .build()
                : null;
    }

    public boolean isEnabled() {
        return storageProperties.enabled() && minioClient != null;
    }

    public StoredInvoice uploadInvoice(Payment payment) {
        if (!isEnabled()) {
            return null;
        }

        String invoiceNumber = buildInvoiceNumber(payment);
        String objectKey = buildObjectKey(payment, invoiceNumber);
        byte[] pdfBytes = buildInvoicePdf(payment, invoiceNumber);

        try {
            ensureBucketExists();
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(storageProperties.bucket())
                            .object(objectKey)
                            .stream(new ByteArrayInputStream(pdfBytes), pdfBytes.length, -1)
                            .contentType("application/pdf")
                            .build()
            );
            return new StoredInvoice(invoiceNumber, objectKey, buildPublicUrl(objectKey));
        } catch (Exception exception) {
            log.warn("Unable to upload invoice PDF for payment {}", payment.getId(), exception);
            return null;
        }
    }

    private void ensureBucketExists() throws Exception {
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(storageProperties.bucket()).build());
        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(storageProperties.bucket()).build());
        }
    }

    private String buildInvoiceNumber(Payment payment) {
        return "INV-" + payment.getId().toString().substring(0, 8).toUpperCase(Locale.ROOT);
    }

    private String buildObjectKey(Payment payment, String invoiceNumber) {
        String prefix = normalizePrefix(storageProperties.invoicesPrefix(), "invoices");
        return "%s/%s/%s.pdf".formatted(prefix, payment.getEventId(), invoiceNumber);
    }

    private String buildPublicUrl(String objectKey) {
        String baseUrl = trimTrailingSlash(storageProperties.publicBaseUrl());
        return "%s/%s/%s".formatted(baseUrl, storageProperties.bucket(), objectKey);
    }

    public String resolvePublicUrl(Payment payment) {
        if (payment == null) {
            return null;
        }
        if (StringUtils.hasText(payment.getInvoiceObjectKey()) && StringUtils.hasText(storageProperties.publicBaseUrl())) {
            return buildPublicUrl(payment.getInvoiceObjectKey());
        }
        return payment.getInvoiceUrl();
    }

    public byte[] downloadInvoice(Payment payment) {
        if (!isEnabled() || payment == null || !StringUtils.hasText(payment.getInvoiceObjectKey())) {
            return null;
        }

        try (InputStream stream = minioClient.getObject(
                GetObjectArgs.builder()
                        .bucket(storageProperties.bucket())
                        .object(payment.getInvoiceObjectKey())
                        .build()
        )) {
            return stream.readAllBytes();
        } catch (Exception exception) {
            log.warn("Unable to download invoice PDF for payment {}", payment.getId(), exception);
            return null;
        }
    }

    private String normalizePrefix(String candidate, String fallback) {
        String value = StringUtils.hasText(candidate) ? candidate.trim() : fallback;
        return value.replaceAll("^/+", "").replaceAll("/+$", "");
    }

    private String trimTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private byte[] buildInvoicePdf(Payment payment, String invoiceNumber) {
        List<String> contentLines = new ArrayList<>();
        String primary = rgb(79, 70, 229);
        String textDark = rgb(17, 24, 39);
        String textLight = rgb(75, 85, 99);
        String textMuted = rgb(107, 114, 128);
        String bgLight = rgb(249, 250, 251);
        String border = rgb(229, 231, 235);
        String white = rgb(255, 255, 255);

        contentLines.addAll(drawRect(0, 0, 595, 842, white, null));
        contentLines.addAll(drawRect(0, 830, 595, 12, primary, null));
        contentLines.addAll(drawTextBlock("EventZen", 45, 775, 28, "F2", primary, 60, 16));
        contentLines.addAll(drawTextBlock("Your Next Great Experience", 45, 755, 11, "F1", textMuted, 60, 15));
        contentLines.addAll(drawTextBlock("INVOICE", 400, 775, 24, "F2", textDark, 60, 16));
        contentLines.addAll(drawTextBlock("Invoice # " + invoiceNumber, 400, 755, 11, "F2", textLight, 60, 15));
        contentLines.addAll(drawTextBlock("Date: " + formatDate(payment.getCreatedAt()), 400, 740, 11, "F1", textLight, 60, 15));
        contentLines.add("q " + border + " RG 45 710 505 1 re S Q");

        int sectionY = 670;
        contentLines.addAll(drawTextBlock("BILLED TO", 45, sectionY, 10, "F2", textMuted, 60, 15));
        contentLines.addAll(drawTextBlock(payment.getCustomerEmail() != null ? payment.getCustomerEmail() : "Event attendee", 45, sectionY - 20, 14, "F2", textDark, 28, 18));
        contentLines.addAll(drawTextBlock(payment.getCustomerEmail() != null ? payment.getCustomerEmail() : "N/A", 45, sectionY - 52, 11, "F1", textLight, 40, 15));
        contentLines.addAll(drawTextBlock("Reference: " + safe(payment.getGatewayReference()), 45, sectionY - 84, 11, "F1", textLight, 40, 15));

        contentLines.addAll(drawTextBlock("EVENT DETAILS", 300, sectionY, 10, "F2", textMuted, 60, 15));
        contentLines.addAll(drawTextBlock(safe(payment.getEventName()), 300, sectionY - 20, 14, "F2", textDark, 32, 18));
        contentLines.addAll(drawTextBlock("Registration ID:", 300, sectionY - 40, 11, "F1", textLight, 40, 15));
        contentLines.addAll(drawTextBlock(safe(payment.getRegistrationId()), 300, sectionY - 55, 11, "F1", textLight, 24, 15));
        contentLines.addAll(drawTextBlock("Payment ID:", 300, sectionY - 85, 11, "F1", textLight, 40, 15));
        contentLines.addAll(drawTextBlock(safe(payment.getId()), 300, sectionY - 100, 11, "F1", textLight, 24, 15));

        int summaryY = 470;
        contentLines.addAll(drawRect(45, summaryY, 505, 75, bgLight, border));
        contentLines.addAll(drawTextBlock("Total Amount Paid", 65, summaryY + 45, 10, "F2", textMuted, 60, 15));
        contentLines.addAll(drawTextBlock(formatCurrency(payment), 65, summaryY + 20, 24, "F2", primary, 60, 16));
        contentLines.addAll(drawTextBlock("Payment Method", 250, summaryY + 45, 10, "F2", textMuted, 60, 15));
        contentLines.addAll(drawTextBlock(payment.getPaymentMethod() != null ? payment.getPaymentMethod().name() : "N/A", 250, summaryY + 25, 12, "F2", textDark, 24, 16));
        contentLines.addAll(drawTextBlock("Payment Date", 400, summaryY + 45, 10, "F2", textMuted, 60, 15));
        contentLines.addAll(drawTextBlock(formatDate(payment.getPaymentDate() != null ? payment.getPaymentDate() : payment.getCreatedAt()), 400, summaryY + 25, 12, "F2", textDark, 20, 16));

        contentLines.addAll(drawTextBlock("PAYMENT DETAILS", 45, 450, 10, "F2", textMuted, 60, 15));
        contentLines.addAll(drawRect(45, 415, 505, 25, bgLight, null));
        contentLines.addAll(drawTextBlock("Description", 60, 423, 10, "F2", textDark, 60, 15));
        contentLines.addAll(drawTextBlock("Value", 250, 423, 10, "F2", textDark, 60, 15));

        String[][] detailRows = {
                {"Payment Reference", safe(payment.getGatewayReference())},
                {"Gateway Order ID", safe(payment.getGatewayOrderId())},
                {"Gateway Payment ID", safe(payment.getGatewayPaymentId())},
                {"Payment Status", payment.getPaymentStatus() != null ? payment.getPaymentStatus().name() : "SUCCEEDED"}
        };

        int rowTop = 380;
        for (String[] row : detailRows) {
            contentLines.add("q " + border + " RG 45 " + (rowTop + 15) + " 505 1 re S Q");
            contentLines.addAll(drawTextBlock(row[0], 60, rowTop, 11, "F1", textLight, 60, 15));
            contentLines.addAll(drawTextBlock(row[1], 250, rowTop, 11, "F2", textDark, 36, 15));
            rowTop -= 35;
        }
        contentLines.add("q " + border + " RG 45 " + (rowTop + 15) + " 505 1 re S Q");

        contentLines.addAll(drawTextBlock("Payment confirmation", 45, 124, 14, "F2", primary, 88, 18));
        contentLines.addAll(drawTextBlock("Thank you for your purchase. This invoice confirms that your payment was successfully received by EventZen.", 45, 104, 10, "F1", textMuted, 88, 13));
        contentLines.addAll(drawTextBlock("For invoice-related support, contact support@eventzen.com with your invoice number.", 45, 76, 10, "F1", textMuted, 88, 13));

        String contentStream = String.join("\n", contentLines);
        List<String> objects = List.of(
                "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
                "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
                "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj",
                "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
                "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj",
                "6 0 obj\n<< /Length " + contentStream.length() + " >>\nstream\n" + contentStream + "\nendstream\nendobj"
        );

        StringBuilder pdf = new StringBuilder("%PDF-1.4\n");
        List<Integer> offsets = new ArrayList<>();
        for (String object : objects) {
            offsets.add(pdf.length());
            pdf.append(object).append('\n');
        }
        int xrefOffset = pdf.length();
        pdf.append("xref\n0 ").append(objects.size() + 1).append('\n');
        pdf.append("0000000000 65535 f \n");
        for (Integer offset : offsets) {
            pdf.append(String.format(Locale.ROOT, "%010d 00000 n \n", offset));
        }
        pdf.append("trailer\n<< /Size ").append(objects.size() + 1).append(" /Root 1 0 R >>\nstartxref\n")
                .append(xrefOffset)
                .append("\n%%EOF");
        return pdf.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static String safe(Object value) {
        return value == null ? "N/A" : value.toString();
    }

    private static String formatDate(OffsetDateTime value) {
        return value == null ? "Pending" : value.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }

    private static String formatCurrency(Payment payment) {
        DecimalFormatSymbols symbols = DecimalFormatSymbols.getInstance(Locale.US);
        DecimalFormat format = new DecimalFormat("#,##0.00", symbols);
        String amount = format.format(payment.getAmount());
        return payment.getCurrency().toUpperCase(Locale.ROOT) + " " + amount;
    }

    private static String rgb(int r, int g, int b) {
        return String.format(Locale.ROOT, "%.3f %.3f %.3f", r / 255d, g / 255d, b / 255d);
    }

    private static List<String> drawRect(int x, int y, int width, int height, String fill, String stroke) {
        List<String> commands = new ArrayList<>();
        commands.add("q");
        commands.add(fill + " rg");
        if (stroke != null) {
            commands.add(stroke + " RG");
        }
        commands.add(x + " " + y + " " + width + " " + height + " re " + (stroke != null ? "B" : "f"));
        commands.add("Q");
        return commands;
    }

    private static List<String> drawTextBlock(String text, int x, int y, int size, String font, String color, int maxChars, int lineGap) {
        List<String> lines = new ArrayList<>();
        int cursorY = y;
        for (String line : wrapText(text, maxChars)) {
            lines.add("BT");
            lines.add("/" + font + " " + size + " Tf");
            lines.add(color + " rg");
            lines.add("1 0 0 1 " + x + " " + cursorY + " Tm");
            lines.add("(" + escapePdfText(line) + ") Tj");
            lines.add("ET");
            cursorY -= lineGap;
        }
        return lines;
    }

    private static List<String> wrapText(String value, int maxChars) {
        List<String> lines = new ArrayList<>();
        String[] words = value.split("\\s+");
        StringBuilder current = new StringBuilder();
        for (String word : words) {
            if (word.isBlank()) {
                continue;
            }
            if (word.length() > maxChars) {
                if (current.length() > 0) {
                    lines.add(current.toString());
                    current = new StringBuilder();
                }
                for (String chunk : chunkWord(word, maxChars)) {
                    lines.add(chunk);
                }
                continue;
            }
            String next = current.length() == 0 ? word : current + " " + word;
            if (next.length() > maxChars && current.length() > 0) {
                lines.add(current.toString());
                current = new StringBuilder(word);
            } else {
                current = new StringBuilder(next);
            }
        }
        if (current.length() > 0) {
            lines.add(current.toString());
        }
        return lines.isEmpty() ? List.of(value) : lines;
    }

    private static List<String> chunkWord(String value, int maxChars) {
        List<String> chunks = new ArrayList<>();
        for (int index = 0; index < value.length(); index += maxChars) {
            chunks.add(value.substring(index, Math.min(index + maxChars, value.length())));
        }
        return chunks;
    }

    private static String escapePdfText(String value) {
        return value
                .replace("\\", "\\\\")
                .replace("(", "\\(")
                .replace(")", "\\)");
    }

    public record StoredInvoice(String invoiceNumber, String objectKey, String publicUrl) {
    }
}
