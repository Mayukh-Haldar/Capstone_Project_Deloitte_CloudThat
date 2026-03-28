package com.eventzen.finance;

import com.eventzen.finance.config.JwtProperties;
import com.eventzen.finance.config.NotificationServiceProperties;
import com.eventzen.finance.config.RazorpayProperties;
import com.eventzen.finance.config.StorageProperties;
import com.eventzen.finance.config.TicketingServiceProperties;
import com.eventzen.finance.config.VenueVendorServiceProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({JwtProperties.class, RazorpayProperties.class, NotificationServiceProperties.class, TicketingServiceProperties.class, VenueVendorServiceProperties.class, StorageProperties.class})
public class FinanceServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(FinanceServiceApplication.class, args);
    }
}
