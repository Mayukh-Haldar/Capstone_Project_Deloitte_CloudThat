package com.eventzen.auth.config;

import com.eventzen.auth.service.AuthNotificationService;
import com.eventzen.auth.service.LoggingAuthNotificationService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AuthNotificationConfiguration {

    @Bean
    @ConditionalOnMissingBean(AuthNotificationService.class)
    AuthNotificationService loggingAuthNotificationService() {
        return new LoggingAuthNotificationService();
    }
}
