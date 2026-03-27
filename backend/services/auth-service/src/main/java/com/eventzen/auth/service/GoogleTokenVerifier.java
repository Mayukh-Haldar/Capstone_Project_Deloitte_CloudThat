package com.eventzen.auth.service;

public interface GoogleTokenVerifier {

    GoogleIdentity verify(String idToken);
}
