package com.eventzen.auth.service;

import com.eventzen.auth.dto.AccountRequestResponse;
import com.eventzen.auth.dto.AccountRequestUserSummary;
import com.eventzen.auth.entity.AccountRequest;
import com.eventzen.auth.entity.User;
import org.springframework.stereotype.Component;

@Component
public class AccountRequestMapper {

    public AccountRequestResponse toResponse(AccountRequest request) {
        User user = request.getUser();
        return new AccountRequestResponse(
                request.getId(),
                request.getType(),
                request.getStatus(),
                request.getReason(),
                request.getAdminComment(),
                request.getReviewedBy(),
                request.getReviewedAt(),
                request.getCreatedAt(),
                new AccountRequestUserSummary(
                        user.getId(),
                        user.getFirstName(),
                        user.getLastName(),
                        user.getEmail(),
                        user.isActive()
                )
        );
    }
}
