package com.eventzen.auth;

import com.eventzen.auth.controller.AuthController;
import com.eventzen.auth.controller.HomeController;
import com.eventzen.auth.controller.UserController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class AuthServiceApplicationTests {

    @Autowired
    private HomeController homeController;

    @Autowired
    private AuthController authController;

    @Autowired
    private UserController userController;

    @Test
    void contextLoads() {
        assertThat(homeController).isNotNull();
        assertThat(authController).isNotNull();
        assertThat(userController).isNotNull();
    }
}
