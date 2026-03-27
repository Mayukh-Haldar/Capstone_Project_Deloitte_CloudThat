package com.eventzen.event.controller;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HomeController {

    @GetMapping("/")
    Map<String, String> home() {
        return Map.of("service", "event-service", "status", "ok");
    }
}
