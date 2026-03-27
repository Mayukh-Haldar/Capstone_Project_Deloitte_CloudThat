package com.eventzen.auth.service;

public interface AuthNotificationService {

    void sendPasswordResetEmail(String email, String firstName, String token);

    void sendEmailVerificationEmail(String email, String firstName, String token);
}
