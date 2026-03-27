package com.eventzen.auth.service;

import com.eventzen.auth.config.AuthFeatureProperties;
import com.eventzen.auth.exception.EventZenException;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class GoogleTokenInfoVerifier implements GoogleTokenVerifier {

    private final RestClient restClient;
    private final AuthFeatureProperties authFeatureProperties;

    public GoogleTokenInfoVerifier(AuthFeatureProperties authFeatureProperties) {
        this.restClient = RestClient.builder()
                .baseUrl("https://oauth2.googleapis.com")
                .build();
        this.authFeatureProperties = authFeatureProperties;
    }

    @Override
    public GoogleIdentity verify(String idToken) {
        if (authFeatureProperties.allowDebugGoogleTokens() && idToken != null && idToken.startsWith("debug-google:")) {
            return buildDebugIdentity(idToken);
        }
        if (authFeatureProperties.googleClientId() == null || authFeatureProperties.googleClientId().isBlank()) {
            throw new EventZenException(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", "AUTH-1018", "Google Sign In is not configured");
        }

        try {
            GoogleTokenInfoResponse response = restClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/tokeninfo").queryParam("id_token", idToken).build())
                    .retrieve()
                    .body(GoogleTokenInfoResponse.class);

            if (response == null || response.sub() == null || response.email() == null) {
                throw new EventZenException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_ERROR", "AUTH-1014", "Google token is invalid");
            }
            if (!authFeatureProperties.googleClientId().equals(response.aud())) {
                throw new EventZenException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_ERROR", "AUTH-1014", "Google token audience is invalid");
            }
            return new GoogleIdentity(
                    response.sub(),
                    response.email(),
                    Boolean.parseBoolean(response.emailVerified()),
                    response.givenName(),
                    response.familyName()
            );
        } catch (RestClientException exception) {
            throw new EventZenException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_ERROR", "AUTH-1014", "Google token is invalid");
        }
    }

    private GoogleIdentity buildDebugIdentity(String idToken) {
        String payload = idToken.substring("debug-google:".length()).trim();
        if (payload.isBlank() || !payload.contains("@")) {
            throw new EventZenException(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", "AUTH-1019", "Debug Google token must be in the format debug-google:user@example.com");
        }
        String localPart = payload.substring(0, payload.indexOf('@'));
        String firstName = localPart.isBlank() ? "Google" : capitalize(localPart.split("[._+-]")[0]);
        return new GoogleIdentity("debug-" + payload.toLowerCase(), payload.toLowerCase(), true, firstName, "User");
    }

    private String capitalize(String value) {
        if (value == null || value.isBlank()) {
            return "Google";
        }
        String trimmed = value.trim();
        return Character.toUpperCase(trimmed.charAt(0)) + trimmed.substring(1).toLowerCase();
    }

    private record GoogleTokenInfoResponse(
            String aud,
            String sub,
            String email,
            @JsonProperty("email_verified") String emailVerified,
            @JsonProperty("given_name") String givenName,
            @JsonProperty("family_name") String familyName
    ) {
    }
}
