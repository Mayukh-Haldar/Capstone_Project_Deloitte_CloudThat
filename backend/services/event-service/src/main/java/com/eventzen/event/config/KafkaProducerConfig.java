package com.eventzen.event.config;

import java.util.Map;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;

/**
 * Overrides the Spring Boot auto-configured Kafka producer to apply resilience
 * settings that prevent HTTP threads from blocking for 60 s when Kafka is down.
 */
@Configuration
public class KafkaProducerConfig {

    @Bean
    public ProducerFactory<String, String> producerFactory(
            @Value("${spring.kafka.bootstrap-servers:localhost:9092}") String bootstrapServers) {

        Map<String, Object> props = Map.of(
            ProducerConfig.BOOTSTRAP_SERVERS_CONFIG,        bootstrapServers,
            ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG,     StringSerializer.class,
            ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG,   StringSerializer.class,
            // Cap how long kafkaTemplate.send() blocks when the broker is unreachable.
            // Default 60 000 ms hangs the HTTP request thread for 60 s.
            ProducerConfig.MAX_BLOCK_MS_CONFIG,             3_000,
            // Slow down the background I/O thread's reconnect loop to eliminate
            // the "Node -1 disconnected / Rebootstrapping" log flood.
            ProducerConfig.RECONNECT_BACKOFF_MS_CONFIG,     2_000,
            ProducerConfig.RECONNECT_BACKOFF_MAX_MS_CONFIG, 30_000,
            // Short per-request and delivery timeouts so failed sends fail fast.
            ProducerConfig.REQUEST_TIMEOUT_MS_CONFIG,       3_000,
            ProducerConfig.DELIVERY_TIMEOUT_MS_CONFIG,      5_000
        );

        return new DefaultKafkaProducerFactory<>(props);
    }

    @Bean
    public KafkaTemplate<String, String> kafkaTemplate(ProducerFactory<String, String> producerFactory) {
        return new KafkaTemplate<>(producerFactory);
    }
}
