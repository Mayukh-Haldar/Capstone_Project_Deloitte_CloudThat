package com.eventzen.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class LoggingAuthNotificationService implements AuthNotificationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(LoggingAuthNotificationService.class);

    @Override
    public void sendPasswordResetEmail(String email, String firstName, String token) {
        LOGGER.info("Password reset token generated for {} ({}): {}", firstName, email, token);
    }

    @Override
    public void sendEmailVerificationEmail(String email, String firstName, String token) {
        LOGGER.info("Email verification token generated for {} ({}): {}", firstName, email, token);
    }
}
