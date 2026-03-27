package com.eventzen.auth.controller;

import java.time.OffsetDateTime;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HomeController {

    @GetMapping("/")
    public Map<String, Object> home() {
        return Map.of(
                "service", "eventzen-auth-service",
                "status", "UP",
                "timestamp", OffsetDateTime.now().toString()
        );
    }
}
