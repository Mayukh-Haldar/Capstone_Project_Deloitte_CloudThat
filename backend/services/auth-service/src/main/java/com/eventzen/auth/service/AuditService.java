package com.eventzen.auth.service;

import com.eventzen.auth.entity.AuditLog;
import com.eventzen.auth.entity.User;
import com.eventzen.auth.repository.AuditLogRepository;
import org.springframework.stereotype.Service;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    public void log(User user, String action, String resourceType, String resourceId, String ipAddress, String details) {
        auditLogRepository.save(AuditLog.of(user, action, resourceType, resourceId, ipAddress, details));
    }
}
