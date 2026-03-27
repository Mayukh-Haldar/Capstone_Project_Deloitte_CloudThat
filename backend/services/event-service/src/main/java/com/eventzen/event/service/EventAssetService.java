package com.eventzen.event.service;

import com.eventzen.event.config.EventStorageProperties;
import com.eventzen.event.dto.UploadedAssetResponse;
import com.eventzen.event.exception.EventServiceException;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.io.InputStream;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class EventAssetService {

    private static final long MAX_IMAGE_SIZE_BYTES = 5L * 1024L * 1024L;
    private static final Set<String> SUPPORTED_CONTENT_TYPES = Set.of("image/jpeg", "image/png", "image/webp", "image/gif");

    private final EventStorageProperties storageProperties;
    private final MinioClient minioClient;

    public EventAssetService(EventStorageProperties storageProperties) {
        this.storageProperties = storageProperties;
        this.minioClient = storageProperties.enabled() && StringUtils.hasText(storageProperties.endpoint())
                ? MinioClient.builder()
                        .endpoint(storageProperties.endpoint())
                        .credentials(storageProperties.accessKey(), storageProperties.secretKey())
                        .build()
                : null;
    }

    public UploadedAssetResponse uploadBannerImage(MultipartFile file) {
        return uploadImage(file, normalizePrefix(storageProperties.eventBannersPrefix(), "event-banners"));
    }

    public UploadedAssetResponse uploadSpeakerPhoto(MultipartFile file) {
        return uploadImage(file, normalizePrefix(storageProperties.speakerPhotosPrefix(), "speaker-photos"));
    }

    private UploadedAssetResponse uploadImage(MultipartFile file, String prefix) {
        if (!storageProperties.enabled() || minioClient == null) {
            throw new EventServiceException(HttpStatus.SERVICE_UNAVAILABLE, "EVENT-503", "Object storage is not configured");
        }
        if (file == null || file.isEmpty()) {
            throw new EventServiceException(HttpStatus.BAD_REQUEST, "EVENT-400", "Please provide an image file");
        }
        if (file.getSize() > MAX_IMAGE_SIZE_BYTES) {
            throw new EventServiceException(HttpStatus.BAD_REQUEST, "EVENT-400", "Images must be 5 MB or smaller");
        }

        String contentType = file.getContentType();
        if (!StringUtils.hasText(contentType) || !SUPPORTED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw new EventServiceException(HttpStatus.BAD_REQUEST, "EVENT-400", "Supported image formats are JPEG, PNG, WEBP, and GIF");
        }

        String extension = inferExtension(file.getOriginalFilename(), contentType);
        String objectKey = buildObjectKey(prefix, extension);

        try (InputStream inputStream = file.getInputStream()) {
            ensureBucketExists();
            minioClient.putObject(
                    PutObjectArgs.builder()
                            .bucket(storageProperties.bucket())
                            .object(objectKey)
                            .stream(inputStream, file.getSize(), -1)
                            .contentType(contentType)
                            .build()
            );
            return new UploadedAssetResponse(objectKey, buildPublicUrl(objectKey));
        } catch (EventServiceException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new EventServiceException(HttpStatus.INTERNAL_SERVER_ERROR, "EVENT-500", "Unable to upload image right now");
        }
    }

    private void ensureBucketExists() throws Exception {
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(storageProperties.bucket()).build());
        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(storageProperties.bucket()).build());
        }
    }

    private String buildObjectKey(String prefix, String extension) {
        String monthPartition = OffsetDateTime.now().format(DateTimeFormatter.ofPattern("yyyy/MM"));
        return "%s/%s/%s%s".formatted(prefix, monthPartition, UUID.randomUUID(), extension);
    }

    private String buildPublicUrl(String objectKey) {
        String baseUrl = trimTrailingSlash(storageProperties.publicBaseUrl());
        return "%s/%s/%s".formatted(baseUrl, storageProperties.bucket(), objectKey);
    }

    private String normalizePrefix(String candidate, String fallback) {
        String value = StringUtils.hasText(candidate) ? candidate.trim() : fallback;
        return value.replaceAll("^/+", "").replaceAll("/+$", "");
    }

    private String trimTrailingSlash(String value) {
        if (!StringUtils.hasText(value)) {
            throw new EventServiceException(HttpStatus.SERVICE_UNAVAILABLE, "EVENT-503", "Object storage public URL is not configured");
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private String inferExtension(String originalFilename, String contentType) {
        if (StringUtils.hasText(originalFilename) && originalFilename.contains(".")) {
            String extension = originalFilename.substring(originalFilename.lastIndexOf('.')).toLowerCase(Locale.ROOT);
            if (extension.matches("\\.[a-z0-9]{1,8}")) {
                return extension;
            }
        }

        return switch (contentType.toLowerCase(Locale.ROOT)) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            default -> ".jpg";
        };
    }
}
