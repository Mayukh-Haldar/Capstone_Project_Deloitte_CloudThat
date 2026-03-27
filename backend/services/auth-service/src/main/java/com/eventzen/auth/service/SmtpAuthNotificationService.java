package com.eventzen.auth.service;

import com.eventzen.auth.config.AuthMailProperties;
import com.eventzen.auth.exception.EventZenException;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnExpression("T(org.springframework.util.StringUtils).hasText('${spring.mail.host:}')")
public class SmtpAuthNotificationService implements AuthNotificationService {

    private final JavaMailSender mailSender;
    private final AuthMailProperties mailProperties;

    public SmtpAuthNotificationService(JavaMailSender mailSender, AuthMailProperties mailProperties) {
        this.mailSender = mailSender;
        this.mailProperties = mailProperties;
    }

    @Override
    public void sendPasswordResetEmail(String email, String firstName, String token) {
        String safeName = displayName(firstName);
        String subject = "Reset your EventZen password";
        String resetUrl = normalizedAppBaseUrl() + "/auth?mode=signin&resetToken=" + token;
        String text = """
                Hi %s,

                We received a request to reset your EventZen password.

                Reset token: %s
                Reset link: %s

                If you did not request this, you can ignore this email.
                """.formatted(safeName, token, resetUrl);
        String html = """
                <p>Hi %s,</p>
                <p>We received a request to reset your EventZen password.</p>
                <p><strong>Reset token:</strong> %s</p>
                <p><a href="%s">Reset your password</a></p>
                <p>If you did not request this, you can ignore this email.</p>
                """.formatted(escapeHtml(safeName), escapeHtml(token), resetUrl);
        sendEmail(email, subject, text, html);
    }

    @Override
    public void sendEmailVerificationEmail(String email, String firstName, String token) {
        String safeName = displayName(firstName);
        String verifyUrl = normalizedAppBaseUrl() + "/account/settings?verificationToken=" + token;
        String subject = "Verify your EventZen email";
        String text = """
                Hi %s,

                Welcome to EventZen. Please verify your email address.

                Verification token: %s
                Verification link: %s

                If you did not create this account, you can ignore this email.
                """.formatted(safeName, token, verifyUrl);
        String html = """
                <p>Hi %s,</p>
                <p>Welcome to EventZen. Please verify your email address.</p>
                <p><strong>Verification token:</strong> %s</p>
                <p><a href="%s">Verify your email</a></p>
                <p>If you did not create this account, you can ignore this email.</p>
                """.formatted(escapeHtml(safeName), escapeHtml(token), verifyUrl);
        sendEmail(email, subject, text, html);
    }

    private void sendEmail(String to, String subject, String text, String html) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setFrom(mailProperties.fromEmail(), mailProperties.fromName());
            helper.setText(text, html);
            mailSender.send(message);
        } catch (MessagingException | MailException | java.io.UnsupportedEncodingException ex) {
            throw new EventZenException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "SYSTEM_ERROR",
                    "AUTH-1020",
                    "Unable to send email right now. Check SMTP settings in auth-service."
            );
        }
    }

    private String normalizedAppBaseUrl() {
        String appBaseUrl = mailProperties.appBaseUrl();
        if (appBaseUrl == null || appBaseUrl.isBlank()) {
            return "http://localhost:5173";
        }
        return appBaseUrl.endsWith("/") ? appBaseUrl.substring(0, appBaseUrl.length() - 1) : appBaseUrl;
    }

    private String displayName(String firstName) {
        return (firstName == null || firstName.isBlank()) ? "there" : firstName.trim();
    }

    private String escapeHtml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
