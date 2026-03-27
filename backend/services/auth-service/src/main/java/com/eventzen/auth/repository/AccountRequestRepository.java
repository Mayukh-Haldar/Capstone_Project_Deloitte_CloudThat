package com.eventzen.auth.repository;

import com.eventzen.auth.entity.AccountRequest;
import com.eventzen.auth.entity.AccountRequestStatus;
import com.eventzen.auth.entity.AccountRequestType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountRequestRepository extends JpaRepository<AccountRequest, UUID> {

    List<AccountRequest> findAllByUser_IdOrderByCreatedAtDesc(UUID userId);

    List<AccountRequest> findAllByStatusOrderByCreatedAtAsc(AccountRequestStatus status);

    List<AccountRequest> findAllByOrderByCreatedAtDesc();

    boolean existsByUser_IdAndTypeAndStatus(UUID userId, AccountRequestType type, AccountRequestStatus status);

    Optional<AccountRequest> findByIdAndUser_Id(UUID id, UUID userId);
}
