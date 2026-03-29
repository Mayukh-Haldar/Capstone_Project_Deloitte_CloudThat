import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarCheck, Lock, Mail } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { GOOGLE_CLIENT_ID } from "../lib/api-config";
import { authApi } from "../lib/auth-api";
import { ApiClientError } from "../lib/http-client";
import { clearAuthSession, setAuthSession, updateAuthSessionUser, useAuthSession } from "../lib/auth-storage";
import { getPortalHomePath, hasAdminRole, hasVendorRole } from "../lib/roles";
const splitName = (fullName) => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
        return { firstName: "", lastName: "" };
    }
    return {
        firstName: parts[0],
        lastName: parts.slice(1).join(" ") || "User"
    };
};
const parseGoogleCredentialEmail = (credential) => {
    try {
        const [, payload] = credential.split(".");
        if (!payload) {
            return "";
        }
        const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
        const decoded = JSON.parse(window.atob(padded));
        return decoded.email || "";
    }
    catch {
        return "";
    }
};
const authHeroImage = "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80";
export function Auth() {
    const [searchParams, setSearchParams] = useSearchParams();
    const modeParam = searchParams.get("mode");
    const [mode, setMode] = useState(modeParam === "signup" ? "signup" : "signin");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [otpCode, setOtpCode] = useState("");
    const [googleOtpCode, setGoogleOtpCode] = useState("");
    const [pendingGoogleCredential, setPendingGoogleCredential] = useState("");
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetToken, setResetToken] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [emailVerificationToken, setEmailVerificationToken] = useState("");
    const [debugEmailToken, setDebugEmailToken] = useState("");
    const [debugResetToken, setDebugResetToken] = useState("");
    const [showReactivationRequest, setShowReactivationRequest] = useState(false);
    const [hasPendingReactivationRequest, setHasPendingReactivationRequest] = useState(false);
    const [reactivationReason, setReactivationReason] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleReady, setGoogleReady] = useState(false);
    const session = useAuthSession();
    const googleButtonRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const isVerificationStep = Boolean(session?.accessToken && session.user.emailVerified === false);
    useEffect(() => {
        setMode(modeParam === "signup" ? "signup" : "signin");
    }, [modeParam]);
    useEffect(() => {
        const tokenFromUrl = searchParams.get("resetToken");
        if (!tokenFromUrl) {
            return;
        }
        setMode("signin");
        setShowForgotPassword(true);
        setResetToken(tokenFromUrl);
        setMessage("Reset token loaded from the email link. Enter your new password to continue.");
        setError("");
    }, [searchParams]);
    useEffect(() => {
        const reason = searchParams.get("reason");
        if (reason === "inactive") {
            setMode("signin");
            setMessage("Your account has been deactivated. Sign in again to request reactivation.");
            setError("");
            setShowReactivationRequest(true);
        }
    }, [searchParams]);
    useEffect(() => {
        setHasPendingReactivationRequest(false);
    }, [email]);
    useEffect(() => {
        if (!showReactivationRequest || !email.trim()) {
            return;
        }
        let cancelled = false;
        const refreshReactivationStatus = async () => {
            try {
                const result = await authApi.getPublicReactivationStatus(email.trim());
                if (cancelled) {
                    return;
                }
                setHasPendingReactivationRequest(result.hasPendingRequest);
                if (!result.accountInactive) {
                    setShowReactivationRequest(false);
                    setReactivationReason("");
                    if (searchParams.get("reason") === "inactive") {
                        const nextParams = new URLSearchParams(searchParams);
                        nextParams.delete("reason");
                        setSearchParams(nextParams, { replace: true });
                    }
                }
            }
            catch {
                if (!cancelled) {
                    setHasPendingReactivationRequest(false);
                }
            }
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void refreshReactivationStatus();
            }
        };
        void refreshReactivationStatus();
        window.addEventListener("focus", refreshReactivationStatus);
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            cancelled = true;
            window.removeEventListener("focus", refreshReactivationStatus);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [email, searchParams, setSearchParams, showReactivationRequest]);
    useEffect(() => {
        if (!GOOGLE_CLIENT_ID || isVerificationStep) {
            setGoogleReady(false);
            return;
        }
        const scriptId = "google-identity-services";
        const renderGoogleButton = () => {
            if (!window.google || !googleButtonRef.current) {
                return;
            }
            googleButtonRef.current.innerHTML = "";
            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: async (response) => {
                    if (!response.credential) {
                        setError("Google sign-in did not return an ID token.");
                        return;
                    }
                    const googleEmail = parseGoogleCredentialEmail(response.credential);
                    if (googleEmail) {
                        setEmail(googleEmail);
                    }
                    await handleGoogleAuth(response.credential);
                },
                ux_mode: "popup",
                auto_select: false
            });
            window.google.accounts.id.renderButton(googleButtonRef.current, {
                type: "standard",
                theme: "outline",
                size: "large",
                text: mode === "signup" ? "signup_with" : "continue_with",
                shape: "rectangular"
            });
            setGoogleReady(true);
        };
        const existingScript = document.getElementById(scriptId);
        if (existingScript) {
            if (window.google) {
                renderGoogleButton();
            }
            else {
                existingScript.addEventListener("load", renderGoogleButton, { once: true });
            }
            return;
        }
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.addEventListener("load", renderGoogleButton, { once: true });
        document.head.appendChild(script);
    }, [isVerificationStep, mode]);
    const setAuthMode = (nextMode) => {
        setMode(nextMode);
        setSearchParams({ mode: nextMode });
        setError("");
        setMessage("");
        setShowForgotPassword(false);
        setShowReactivationRequest(false);
        setHasPendingReactivationRequest(false);
    };
    const resolvePostLoginPath = (roles) => {
        if (location?.state?.from) {
            return location.state.from;
        }
        if (hasAdminRole(roles)) {
            return getPortalHomePath("ADMIN");
        }
        if (hasVendorRole(roles)) {
            return getPortalHomePath("VENDOR");
        }
        return getPortalHomePath("CUSTOMER");
    };
    const lookupReactivationStatus = async (candidateEmail) => {
        if (!candidateEmail.trim()) {
            setHasPendingReactivationRequest(false);
            return { accountInactive: false, hasPendingRequest: false };
        }
        try {
            const result = await authApi.getPublicReactivationStatus(candidateEmail.trim());
            setHasPendingReactivationRequest(result.hasPendingRequest);
            return result;
        }
        catch {
            setHasPendingReactivationRequest(false);
            return { accountInactive: false, hasPendingRequest: false };
        }
    };
    const handleError = async (err) => {
        if (err instanceof ApiClientError) {
            const detailMessage = Array.isArray(err.details) && err.details.length > 0
                ? err.details
                    .map((detail) => {
                    if (typeof detail === "object" && detail !== null) {
                        const field = "field" in detail ? String(detail.field) : "field";
                        const issue = "issue" in detail ? String(detail.issue) : "is invalid";
                        return `${field}: ${issue}`;
                    }
                    return String(detail);
                })
                    .join(", ")
                : "";
            if (err.code === "AUTH-1007" || err.message.toLowerCase().includes("mfa")) {
                setShowOtpInput(true);
            }
            if (err.code === "AUTH-1002" && err.message.toLowerCase().includes("inactive")) {
                setShowReactivationRequest(true);
                const status = await lookupReactivationStatus(email);
                if (status.accountInactive) {
                    setError("Your account is inactive. Submit a reactivation request below.");
                    return;
                }
            }
            else if (mode === "signin" && email.trim()) {
                const status = await lookupReactivationStatus(email);
                if (status.accountInactive) {
                    setShowReactivationRequest(true);
                    setError("Your account is inactive. Submit a reactivation request below.");
                    return;
                }
            }
            setError(detailMessage || err.message);
            return;
        }
        setError("Something went wrong. Please try again.");
    };
    const handleGoogleAuth = async (credential, otpOverride) => {
        setError("");
        setMessage("");
        setLoading(true);
        const googleEmail = parseGoogleCredentialEmail(credential);
        if (googleEmail) {
            setEmail(googleEmail);
        }
        try {
            const result = await authApi.googleLogin({
                idToken: credential,
                otpCode: otpOverride?.trim() || undefined
            });
            setPendingGoogleCredential("");
            setGoogleOtpCode("");
            handleAuthenticatedSuccess(result);
        }
        catch (err) {
            if (err instanceof ApiClientError && err.message.toLowerCase().includes("mfa")) {
                setPendingGoogleCredential(credential);
                setError("Enter your MFA code to finish Google sign-in.");
            }
            else if (err instanceof ApiClientError && err.message.toLowerCase().includes("inactive")) {
                setShowReactivationRequest(true);
                setPendingGoogleCredential("");
                setGoogleOtpCode("");
                const status = await lookupReactivationStatus(googleEmail || email);
                if (status.accountInactive) {
                    setError("Your account is inactive. Submit a reactivation request below.");
                }
                else {
                    setError(err.message);
                }
            }
            else {
                await handleError(err);
            }
        }
        finally {
            setLoading(false);
        }
    };
    const handleAuthenticatedSuccess = (payload) => {
        setAuthSession(payload);
        setEmail(payload.user.email);
        if (!payload.user.emailVerified || !payload.user.mfaEnabled) {
            setMessage("Your account needs a quick security setup before you continue.");
            navigate("/account/settings");
            return;
        }
        navigate(resolvePostLoginPath(payload.user.roles));
    };
    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        if (!email.trim() || !password.trim()) {
            setError("Please enter your email and password.");
            return;
        }
        if (mode === "signup") {
            if (!fullName.trim()) {
                setError("Please enter your full name.");
                return;
            }
            if (password !== confirmPassword) {
                setError("Passwords do not match.");
                return;
            }
        }
        setLoading(true);
        try {
            if (mode === "signup") {
                const { firstName, lastName } = splitName(fullName);
                const result = await authApi.register({
                    firstName,
                    lastName,
                    email: email.trim(),
                    password: password.trim(),
                    phone: phone.trim() || undefined
                });
                setDebugEmailToken(result.debugTokens.emailVerificationToken || "");
                handleAuthenticatedSuccess(result.data);
            }
            else {
                const result = await authApi.login({
                    email: email.trim(),
                    password: password.trim(),
                    otpCode: otpCode.trim() || undefined
                });
                handleAuthenticatedSuccess(result);
            }
        }
        catch (err) {
            await handleError(err);
        }
        finally {
            setLoading(false);
        }
    };
    const handleResendVerification = async () => {
        setError("");
        setMessage("");
        setLoading(true);
        try {
            const result = await authApi.resendEmailVerification(email.trim());
            setDebugEmailToken(result.debugTokens.emailVerificationToken || "");
            setMessage(result.message);
        }
        catch (err) {
            await handleError(err);
        }
        finally {
            setLoading(false);
        }
    };
    const handleConfirmEmail = async () => {
        setError("");
        setMessage("");
        if (!emailVerificationToken.trim()) {
            setError("Enter the verification token from the email.");
            return;
        }
        setLoading(true);
        try {
            const result = await authApi.confirmEmailVerification(emailVerificationToken.trim());
            const freshUser = await authApi.me();
            updateAuthSessionUser(freshUser);
            setMessage(result.message);
            navigate(resolvePostLoginPath(freshUser.roles));
        }
        catch (err) {
            await handleError(err);
        }
        finally {
            setLoading(false);
        }
    };
    const handleSendReset = async () => {
        setError("");
        setMessage("");
        if (!email.trim()) {
            setError("Enter your email address first.");
            return;
        }
        setLoading(true);
        try {
            const result = await authApi.forgotPassword(email.trim());
            setDebugResetToken(result.debugTokens.passwordResetToken || "");
            setMessage(result.message);
        }
        catch (err) {
            await handleError(err);
        }
        finally {
            setLoading(false);
        }
    };
    const handleResetPassword = async () => {
        setError("");
        setMessage("");
        if (!resetToken.trim() || !newPassword.trim()) {
            setError("Enter the reset token and your new password.");
            return;
        }
        setLoading(true);
        try {
            const result = await authApi.resetPassword(resetToken.trim(), newPassword.trim());
            setMessage(result.message);
            setShowForgotPassword(false);
            setResetToken("");
            setNewPassword("");
            setMode("signin");
            setSearchParams({ mode: "signin" });
        }
        catch (err) {
            await handleError(err);
        }
        finally {
            setLoading(false);
        }
    };
    const handleLogout = async () => {
        setLoading(true);
        try {
            if (session?.refreshToken) {
                await authApi.logout(session.refreshToken);
            }
        }
        catch {
            // Ignore logout API failures and clear local state.
        }
        finally {
            clearAuthSession();
            setLoading(false);
            setMessage("Signed out successfully.");
        }
    };
    const handleGoogleOtpSubmit = async () => {
        if (!pendingGoogleCredential) {
            setError("Start Google sign-in first.");
            return;
        }
        if (!googleOtpCode.trim()) {
            setError("Enter the 6-digit MFA code for Google sign-in.");
            return;
        }
        await handleGoogleAuth(pendingGoogleCredential, googleOtpCode);
    };
    const handleRequestReactivation = async () => {
        setError("");
        setMessage("");
        if (!email.trim()) {
            setError("Enter your email address first.");
            return;
        }
        setLoading(true);
        try {
            const result = await authApi.requestPublicReactivation(email.trim(), reactivationReason.trim() || undefined);
            setMessage(result.message);
            setShowReactivationRequest(true);
            setHasPendingReactivationRequest(true);
            setReactivationReason("");
        }
        catch (err) {
            await handleError(err);
        }
        finally {
            setLoading(false);
        }
    };
    return (<section className="relative min-h-screen bg-slate-100 p-4 sm:p-8 dark:bg-[#060d20]">
      {/* Gradient backdrop for auth page */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[20%] right-[10%] h-[600px] w-[500px] rounded-full bg-blue-500/[0.08] blur-[100px] dark:bg-[#1132d4]/[0.25]"/>
        <div className="absolute bottom-[0%] left-[5%] h-[500px] w-[500px] rounded-full bg-indigo-300/[0.06] blur-[90px] dark:bg-[#4f7cff]/[0.10]"/>
      </div>
      <div className="relative mx-auto grid max-w-[1380px] overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl shadow-slate-300/40 lg:grid-cols-2 dark:border-white/10 dark:bg-[#0d1429] dark:shadow-black/50">
        <div className="relative hidden min-h-[780px] overflow-hidden bg-[linear-gradient(160deg,#091431_0%,#10235b_42%,#0a1634_100%)] lg:block">
          <img src={authHeroImage} alt="Modern event venue with keynote stage" className="absolute inset-x-8 top-24 h-[330px] w-[calc(100%-4rem)] rounded-[2rem] object-cover shadow-2xl"/>
          <div className="absolute inset-x-8 top-24 h-[330px] rounded-[2rem] bg-[linear-gradient(180deg,rgba(6,16,36,0.02),rgba(6,16,36,0.44))]"/>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_24%)]"/>
          <div className="absolute bottom-[12%] left-[8%] h-52 w-52 rounded-full bg-blue-400/10 blur-3xl"/>
          <div className="absolute bottom-[10%] right-[10%] h-44 w-44 rounded-full bg-cyan-300/10 blur-3xl"/>
          <div className="relative flex h-full flex-col justify-between p-10 text-white">
            <div className="flex items-center gap-3 font-display text-3xl font-bold">
              <div className="rounded-xl bg-white p-2 text-[#1132d4]">
                <CalendarCheck className="size-6"/>
              </div>
              EventZen
            </div>
            <div className="max-w-lg rounded-[2rem] border border-white/12 bg-white/6 p-8 backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-100/80">Unified event operations</p>
              <h2 className="mt-4 font-display text-5xl font-bold leading-[1.02]">Plan, launch, and run standout experiences.</h2>
              <p className="mt-5 text-xl leading-9 text-white/82">
                Sign in to coordinate venues, vendors, ticketing, approvals, bookings, and every operational detail in one workspace.
              </p>
            </div>
            <div className="flex items-center gap-3 text-lg text-white/90">
              <div className="flex -space-x-3">
                {["AL", "MK", "SJ"].map((initials) => (<div key={initials} aria-hidden="true" className="flex size-10 items-center justify-center rounded-full border-2 border-[#1132d4] bg-white/15 text-sm font-semibold text-white backdrop-blur-sm">
                    {initials}
                  </div>))}
              </div>
              Trusted by 50k+ professionals
            </div>
          </div>
        </div>

        <div className="flex max-h-[calc(100vh-2rem)] items-start overflow-y-auto p-6 sm:p-10 lg:p-12">
          <div className="mx-auto w-full max-w-xl py-2 sm:py-4">
            {isVerificationStep ? (<div className="space-y-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#1132d4]">Email Verification</p>
                  <h1 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl lg:text-4xl dark:text-slate-100">Confirm your email</h1>
                  <p className="mt-3 text-base text-slate-500 dark:text-slate-400">
                    We have sent a verification email to <span className="font-semibold text-slate-700 dark:text-slate-200">{session?.user.email}</span>.
                    Enter the token from the email below to finish signing in.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#111a33]">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">Verification token</span>
                    <input value={emailVerificationToken} onChange={(event) => setEmailVerificationToken(event.target.value)} placeholder="Paste token from email" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429] dark:text-white"/>
                  </label>

                  {debugEmailToken && (<div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      Debug token available in dev mode:
                      <code className="mt-1 block break-all rounded bg-white/70 px-2 py-1">{debugEmailToken}</code>
                    </div>)}

                  {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                  {message && <p className="mt-4 text-sm text-emerald-600">{message}</p>}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" onClick={handleConfirmEmail} disabled={loading} className="rounded-xl bg-[#1132d4] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
                      {loading ? "Verifying..." : "Verify Email"}
                    </button>
                    <button type="button" onClick={handleResendVerification} disabled={loading} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold dark:border-white/15">
                      Resend Email
                    </button>
                    <button type="button" onClick={handleLogout} disabled={loading} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold dark:border-white/15">
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>) : (<>
                <div>
                  <h1 className="text-3xl font-black text-slate-900 sm:text-4xl lg:text-5xl dark:text-slate-100">
                    {mode === "signin" ? "Welcome back" : "Create your account"}
                  </h1>
                  <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">
                    {mode === "signin"
                ? "Sign in to continue to your workspace."
                : "Start planning, managing, and growing your next event."}
                  </p>
                </div>

                <div className="mt-8 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-base font-semibold dark:bg-white/10">
                  <button type="button" onClick={() => setAuthMode("signin")} className={mode === "signin" ? "rounded-lg bg-white py-3 text-slate-900 shadow-sm dark:bg-[#1c2540] dark:text-white" : "py-3 text-slate-500"}>
                    Sign In
                  </button>
                  <button type="button" onClick={() => setAuthMode("signup")} className={mode === "signup" ? "rounded-lg bg-white py-3 text-slate-900 shadow-sm dark:bg-[#1c2540] dark:text-white" : "py-3 text-slate-500"}>
                    Create Account
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-300 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#111a33]">
                  <div className="rounded-xl border border-slate-300 p-3 dark:border-white/15">
                    {GOOGLE_CLIENT_ID ? (<div className="space-y-3">
                        <div className="flex justify-center">
                          <div ref={googleButtonRef} className="min-h-11 w-full"/>
                        </div>
                        {pendingGoogleCredential && (<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0d1429]">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Google MFA verification</p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              This account has MFA enabled. Enter the authenticator code to finish Google sign-in.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <input value={googleOtpCode} onChange={(event) => setGoogleOtpCode(event.target.value)} placeholder="6-digit MFA code" className="w-full flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1132d4] dark:border-white/15 dark:bg-[#111a33] dark:text-white"/>
                              <button type="button" onClick={handleGoogleOtpSubmit} disabled={loading} className="rounded-lg bg-[#1132d4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                                Verify & Continue
                              </button>
                            </div>
                          </div>)}
                      </div>) : (<div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:bg-[#0d1429] dark:text-slate-400">
                        Google sign-in is disabled until `VITE_GOOGLE_CLIENT_ID` is configured in the frontend.
                      </div>)}
                    {GOOGLE_CLIENT_ID && !googleReady && (<p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">Loading Google sign-in...</p>)}
                  </div>

                  <div className="my-5 flex items-center gap-4 text-sm text-slate-400">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-white/10"/>
                    <span>or continue with email</span>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-white/10"/>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === "signup" && (<>
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">Full Name<span className="required-mark">*</span></span>
                          <input required={mode === "signup"} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Enter your full name" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429] dark:text-white"/>
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">Phone Number</span>
                          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Optional" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429] dark:text-white"/>
                        </label>
                      </>)}

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">Email Address<span className="required-mark">*</span></span>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"/>
                        <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="w-full rounded-xl border border-slate-300 py-3 pl-12 pr-4 text-base outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429] dark:text-white"/>
                      </div>
                    </label>

                    <label className="block">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Password<span className="required-mark">*</span></span>
                        {mode === "signin" && (<button type="button" onClick={() => setShowForgotPassword((value) => !value)} className="text-sm font-medium text-[#1132d4]">
                            Forgot password?
                          </button>)}
                      </div>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400"/>
                        <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" className="w-full rounded-xl border border-slate-300 py-3 pl-12 pr-4 text-base outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429] dark:text-white"/>
                      </div>
                    </label>

                    {mode === "signup" && (<label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">Confirm Password<span className="required-mark">*</span></span>
                        <input type="password" required={mode === "signup"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429] dark:text-white"/>
                      </label>)}

                    {showOtpInput && mode === "signin" && (<label className="block">
                        <span className="mb-2 block text-sm font-semibold text-slate-800 dark:text-slate-200">Authenticator Code<span className="required-mark">*</span></span>
                        <input required={showOtpInput && mode === "signin"} value={otpCode} onChange={(event) => setOtpCode(event.target.value)} placeholder="6-digit code" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429] dark:text-white"/>
                      </label>)}

                    {showForgotPassword && mode === "signin" && (<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0d1429]">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Reset your password</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          Enter your email to receive reset instructions, then use the reset token to create a new password.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={handleSendReset} disabled={loading} className="rounded-lg bg-[#1132d4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                            Send reset email
                          </button>
                          <input value={resetToken} onChange={(event) => setResetToken(event.target.value)} placeholder="Reset token" className="w-full flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1132d4] dark:border-white/15 dark:bg-[#111a33] dark:text-white"/>
                          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password" className="w-full flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1132d4] dark:border-white/15 dark:bg-[#111a33] dark:text-white"/>
                        </div>
                        {debugResetToken && (<div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                            Debug reset token:
                            <code className="mt-1 block break-all rounded bg-white/70 px-2 py-1">{debugResetToken}</code>
                          </div>)}
                        <div className="mt-3">
                          <button type="button" onClick={handleResetPassword} disabled={loading} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-white/15">
                            Reset Password
                          </button>
                        </div>
                      </div>)}

                    {showReactivationRequest && mode === "signin" && (<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Account inactive</p>
                        <p className="mt-1 text-sm text-amber-800 dark:text-amber-100/80">
                          This account is currently inactive. You can submit a reactivation request for admin review directly from here.
                        </p>
                        {hasPendingReactivationRequest && (<div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                            A reactivation request for this email is already pending review.
                          </div>)}
                        <textarea value={reactivationReason} onChange={(event) => setReactivationReason(event.target.value)} rows={3} placeholder="Optional note for the admin reviewing your reactivation" className="mt-3 w-full rounded-lg border border-amber-300 px-3 py-2 text-sm outline-none focus:border-[#1132d4] dark:border-amber-500/30 dark:bg-[#111a33] dark:text-white"/>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={handleRequestReactivation} disabled={loading || hasPendingReactivationRequest} className="rounded-lg bg-[#1132d4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                            Request Reactivation
                          </button>
                          <button type="button" onClick={() => setShowReactivationRequest(false)} disabled={loading} className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 dark:border-amber-500/30 dark:text-amber-200">
                            Dismiss
                          </button>
                        </div>
                      </div>)}

                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {message && <p className="text-sm text-emerald-600">{message}</p>}

                    <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1132d4] px-4 py-3 text-base font-bold text-white shadow-lg shadow-blue-700/30 transition hover:bg-[#0f2dc0] disabled:opacity-60">
                      {loading ? "Please wait..." : mode === "signin" ? "Sign In" : "Create Account"}
                      <ArrowRight className="size-5"/>
                    </button>
                  </form>
                </div>

                <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  {mode === "signin" ? "Need an account?" : "Already have an account?"}{" "}
                  <button type="button" onClick={() => setAuthMode(mode === "signin" ? "signup" : "signin")} className="font-semibold text-[#1132d4]">
                    {mode === "signin" ? "Create account" : "Sign in"}
                  </button>
                </p>

                <p className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  <Link to="/" className="font-semibold text-[#1132d4]">
                    Back to homepage
                  </Link>
                </p>
              </>)}
          </div>
        </div>
      </div>
    </section>);
}
