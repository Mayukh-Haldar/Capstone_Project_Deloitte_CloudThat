package com.eventzen.auth;

import com.eventzen.auth.config.AuthBootstrapProperties;
import com.eventzen.auth.config.AuthFeatureProperties;
import com.eventzen.auth.config.AuthMailProperties;
import com.eventzen.auth.config.CryptoProperties;
import com.eventzen.auth.config.JwtProperties;
import com.eventzen.auth.config.NotificationServiceProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({
        JwtProperties.class,
        AuthBootstrapProperties.class,
        CryptoProperties.class,
        AuthFeatureProperties.class,
        AuthMailProperties.class,
        NotificationServiceProperties.class
})
public class AuthServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AuthServiceApplication.class, args);
    }
}
