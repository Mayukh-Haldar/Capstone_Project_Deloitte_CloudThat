import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ImagePlus, MailCheck, QrCode, ShieldCheck, UserRound } from "lucide-react";
import { useSearchParams } from "react-router";
import { authApi } from "../lib/auth-api";
import { ApiClientError } from "../lib/http-client";
import { updateAuthSessionProfilePhoto, updateAuthSessionUser, useAuthSession } from "../lib/auth-storage";
import { getPortalLabel, getPrimaryPortal } from "../lib/roles";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
const splitName = (firstName, lastName) => `${firstName} ${lastName}`.trim();
const buildQrImageUrl = (value) => `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(value)}`;
export function AccountSettings() {
    const [searchParams, setSearchParams] = useSearchParams();
    const session = useAuthSession();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [verificationToken, setVerificationToken] = useState("");
    const [mfaCode, setMfaCode] = useState("");
    const [mfaSetupUri, setMfaSetupUri] = useState("");
    const [debugEmailToken, setDebugEmailToken] = useState("");
    const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
    const [accountRequests, setAccountRequests] = useState([]);
    const [requestNotes, setRequestNotes] = useState({
        DEACTIVATE: "",
        REACTIVATE: "",
        GDPR_DELETE: "",
        VENDOR_ACCESS: ""
    });
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [requestLoading, setRequestLoading] = useState(false);
    const isAdmin = session?.user.roles.some((role) => role.toUpperCase() === "ADMIN") ?? false;
    useEffect(() => {
        if (!session?.user) {
            return;
        }
        setFullName(splitName(session.user.firstName, session.user.lastName));
        setEmail(session.user.email);
        setPhone(session.user.phone || "");
        setProfilePhotoUrl(session.user.profilePhotoUrl || "");
    }, [session?.user]);
    useEffect(() => {
        const tokenFromUrl = searchParams.get("verificationToken");
        if (!tokenFromUrl) {
            return;
        }
        setVerificationToken(tokenFromUrl);
        setMessage("Verification token loaded from the email link. Click 'Verify My Email' to finish.");
        setError("");
    }, [searchParams]);
    useEffect(() => {
        if (!session?.user || isAdmin) {
            return;
        }
        authApi.listMyAccountRequests()
            .then(setAccountRequests)
            .catch(() => undefined);
    }, [session?.user, isAdmin]);
    const refreshUser = async () => {
        const freshUser = await authApi.me();
        updateAuthSessionUser(freshUser);
        return freshUser;
    };
    const handleError = (err) => {
        if (err instanceof ApiClientError) {
            setError(err.message);
            return;
        }
        setError("Something went wrong. Please try again.");
    };
    const avatarFallback = fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "EZ";
    const handleProfilePhotoChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        if (!file.type.startsWith("image/")) {
            setError("Please upload a valid image file.");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = typeof reader.result === "string" ? reader.result : "";
            setProfilePhotoUrl(result);
            updateAuthSessionProfilePhoto(result);
            setMessage("Profile photo updated successfully.");
            setError("");
        };
        reader.onerror = () => {
            setError("Unable to read the selected image.");
        };
        reader.readAsDataURL(file);
        event.target.value = "";
    };
    const handleRemoveProfilePhoto = () => {
        setProfilePhotoUrl("");
        updateAuthSessionProfilePhoto(null);
        setMessage("Profile photo removed.");
        setError("");
    };
    const handleProfileUpdate = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        const parts = fullName.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) {
            setError("Enter your full name.");
            return;
        }
        setLoading(true);
        try {
            const result = await authApi.updateProfile({
                firstName: parts[0],
                lastName: parts.slice(1).join(" ") || "User",
                phone: phone.trim()
            });
            updateAuthSessionUser(result.user);
            setDebugEmailToken(result.debugTokens.emailVerificationToken || "");
            setMessage("Profile updated successfully.");
        }
        catch (err) {
            handleError(err);
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
            handleError(err);
        }
        finally {
            setLoading(false);
        }
    };
    const handleConfirmVerification = async () => {
        setError("");
        setMessage("");
        if (!verificationToken.trim()) {
            setError("Enter the verification token from your email.");
            return;
        }
        setLoading(true);
        try {
            const result = await authApi.confirmEmailVerification(verificationToken.trim());
            await refreshUser();
            setMessage(result.message);
            setVerificationToken("");
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete("verificationToken");
            setSearchParams(nextParams, { replace: true });
        }
        catch (err) {
            handleError(err);
        }
        finally {
            setLoading(false);
        }
    };
    const handleGenerateMfa = async () => {
        setError("");
        setMessage("");
        setLoading(true);
        try {
            const result = await authApi.setupMfa();
            setMfaSetupUri(result.otpauthUri);
            setMessage("Scan the QR code with Google Authenticator, Authy, or another authenticator app.");
        }
        catch (err) {
            handleError(err);
        }
        finally {
            setLoading(false);
        }
    };
    const handleVerifyMfa = async () => {
        setError("");
        setMessage("");
        if (!mfaCode.trim()) {
            setError("Enter the 6-digit code from your authenticator app.");
            return;
        }
        setLoading(true);
        try {
            const result = await authApi.verifyMfa(mfaCode.trim());
            await refreshUser();
            setMessage(result.message);
            setMfaCode("");
        }
        catch (err) {
            handleError(err);
        }
        finally {
            setLoading(false);
        }
    };
    const refreshAccountRequests = async () => {
        if (!session?.user || isAdmin) {
            return;
        }
        const requests = await authApi.listMyAccountRequests();
        setAccountRequests(requests);
    };
    const handleSubmitAccountRequest = async (type) => {
        setError("");
        setMessage("");
        setRequestLoading(true);
        try {
            await authApi.submitAccountRequest(type, requestNotes[type]?.trim() || undefined);
            await refreshAccountRequests();
            setRequestNotes((current) => ({ ...current, [type]: "" }));
            setMessage(`${type.replaceAll("_", " ")} request submitted successfully.`);
        }
        catch (err) {
            handleError(err);
        }
        finally {
            setRequestLoading(false);
        }
    };
    const handleCancelRequest = async (requestId) => {
        setError("");
        setMessage("");
        setRequestLoading(true);
        try {
            const result = await authApi.cancelAccountRequest(requestId);
            await refreshAccountRequests();
            setMessage(result.message);
        }
        catch (err) {
            handleError(err);
        }
        finally {
            setRequestLoading(false);
        }
    };
    const formatRequestType = (type) => type.toLowerCase().replaceAll("_", " ");
    const formatRequestStatus = (status) => status.toLowerCase().replaceAll("_", " ");
    const pendingRequestFor = (type) => accountRequests.find((request) => request.type === type && request.status === "PENDING");
    const userTypeLabel = (() => {
        const primaryPortal = getPrimaryPortal(session);
        return primaryPortal ? `${getPortalLabel(primaryPortal)} Account` : "User Account";
    })();
    const requestCards = [];
    if (session?.user.active) {
        requestCards.push({
            type: "DEACTIVATE",
            title: "Deactivate Account Request",
            description: "Ask an administrator to deactivate your account. Your sessions will be revoked once approved.",
            buttonLabel: "Request Deactivation",
            tone: "border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10"
        });
    }
    else {
        requestCards.push({
            type: "REACTIVATE",
            title: "Reactivate Account Request",
            description: "If your account is inactive, submit a request here so an administrator can restore access.",
            buttonLabel: "Request Reactivation",
            tone: "border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/20 dark:bg-emerald-500/10"
        });
    }
    requestCards.push({
        type: "GDPR_DELETE",
        title: "Delete Request",
        description: "Submit a right-to-erasure request for administrative review. Approved requests anonymize your account according to GDPR.",
        buttonLabel: "Request GDPR Delete",
        tone: "border-rose-200 bg-rose-50/80 dark:border-rose-500/20 dark:bg-rose-500/10",
        linkHref: "https://gdpr-info.eu/",
        linkLabel: "Read GDPR information"
    });
    return (<section className="relative min-h-screen text-slate-900 dark:text-slate-100">
      {/* Gradient header band */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-blue-200/80 via-blue-100/40 to-transparent dark:from-[#0d1942]/90 dark:via-[#070d1f]/50 dark:to-transparent"/>
      <div className="relative mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header>
          <p className="text-xs font-semibold tracking-[0.2em] text-[#1132d4]">ACCOUNT</p>
          <h1 className="eventzen-page-title mt-2">Settings & Security</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Manage your profile details, confirm your email, and strengthen your account with multi-factor authentication.
          </p>
        </header>

        {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[#1132d4]/10 p-3 text-[#1132d4]">
                  <UserRound className="size-5"/>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Profile</h2>
                  <p className="text-base font-semibold text-slate-600 dark:text-slate-300">{userTypeLabel}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <Avatar className="size-16 border-2 border-white bg-slate-100 shadow-sm dark:border-white/15 dark:bg-[#13244c]">
                  <AvatarImage src={profilePhotoUrl || undefined} alt={`${fullName || "User"} profile`} className="object-cover"/>
                  <AvatarFallback className="bg-[#1132d4]/10 font-semibold text-[#1132d4]">
                    {avatarFallback}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-wrap justify-end gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/20 dark:bg-[#0d1429] dark:text-slate-200 dark:hover:bg-white/5">
                    <ImagePlus className="size-4"/>
                    Upload Photo
                    <input type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoChange}/>
                  </label>
                  {profilePhotoUrl && (<button type="button" onClick={handleRemoveProfilePhoto} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/20 dark:text-slate-200 dark:hover:bg-white/5">
                      Remove
                    </button>)}
                </div>
                <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-center shadow-sm dark:border-white/10 dark:bg-[#0d1429]/80">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Photo Preview</p>
                  <Avatar className="mx-auto mt-3 size-24 border-4 border-white bg-slate-100 shadow-md dark:border-white/15 dark:bg-[#13244c]">
                    <AvatarImage src={profilePhotoUrl || undefined} alt={`${fullName || "User"} preview`} className="object-cover"/>
                    <AvatarFallback className="bg-[#1132d4]/10 text-lg font-semibold text-[#1132d4]">
                      {avatarFallback}
                    </AvatarFallback>
                  </Avatar>
                  <p className="mt-3 max-w-[12rem] text-xs text-slate-500 dark:text-slate-400">
                    This preview shows how your profile photo will appear inside the circular avatar.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleProfileUpdate} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Full Name<span className="required-mark">*</span></span>
                <input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429]"/>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Email</span>
                <input value={email} readOnly disabled className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-base text-slate-400 outline-none dark:border-white/10 dark:bg-[#0d1429]/60 dark:text-slate-500"/>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Phone</span>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429]"/>
              </label>

              <button type="submit" disabled={loading} className="rounded-xl bg-[#1132d4] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
                Save Profile
              </button>
            </form>
          </article>

          <div className="space-y-6">
            <article className="rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700">
                  <MailCheck className="size-5"/>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Email Verification</h2>
                  <p className="text-sm text-slate-500">
                    {session?.user.emailVerified ? "Your email is verified." : "Verification required for account security."}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm dark:bg-[#0d1429]">
                <p>Status: <span className="font-semibold">{session?.user.emailVerified ? "Verified" : "Pending verification"}</span></p>
              </div>

              {!session?.user.emailVerified && (<div className="mt-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleResendVerification} disabled={loading} className="rounded-xl bg-[#1132d4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                      Resend Verification Email
                    </button>
                  </div>
                  <input value={verificationToken} onChange={(event) => setVerificationToken(event.target.value)} placeholder="Enter token from email" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429]"/>
                  <button type="button" onClick={handleConfirmVerification} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-white/20">
                    Verify My Email
                  </button>
                  {debugEmailToken && (<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      Debug token:
                      <code className="mt-1 block break-all rounded bg-white/70 px-2 py-1">{debugEmailToken}</code>
                    </div>)}
                </div>)}
            </article>

            <article className="rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-100 p-3 text-[#1132d4]">
                  <ShieldCheck className="size-5"/>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Multi-Factor Authentication</h2>
                  <p className="text-sm text-slate-500">
                    {session?.user.mfaEnabled ? "MFA is enabled on your account." : "Set up MFA by scanning the QR code below."}
                  </p>
                </div>
              </div>

              {!session?.user.mfaEnabled ? (<div className="mt-4 space-y-4">
                  <button type="button" onClick={handleGenerateMfa} disabled={loading} className="rounded-xl bg-[#1132d4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    Generate QR Code
                  </button>

                  {mfaSetupUri && (<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#0d1429]">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <QrCode className="size-4"/>
                        Scan this QR code in your authenticator app
                      </div>
                      <img src={buildQrImageUrl(mfaSetupUri)} alt="MFA QR code" className="mt-4 size-[180px] rounded-xl border border-slate-200 bg-white p-2 sm:size-[220px]" width={220} height={220}/>
                      <p className="mt-3 text-xs text-slate-500 break-all">{mfaSetupUri}</p>
                    </div>)}

                  <input value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="Enter 6-digit code after scanning" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429]"/>
                  <button type="button" onClick={handleVerifyMfa} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-white/20">
                    Verify MFA Setup
                  </button>
                </div>) : (<div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <CheckCircle2 className="size-4 shrink-0"/>
                  Your account is protected with MFA.
                </div>)}
            </article>
          </div>
        </div>

        {!isAdmin && (<div className="grid gap-6">
            <article className="rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                  <AlertTriangle className="size-5"/>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Account Requests</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Submit sensitive account actions for administrator review.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {requestCards.map((card) => {
                const pending = pendingRequestFor(card.type);
                return (<div key={card.type} className={`rounded-2xl border p-5 flex flex-col ${card.tone}`}>
                      <h3 className="text-lg font-semibold">{card.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{card.description}</p>
                      {card.linkHref && card.linkLabel && (<a href={card.linkHref} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm font-semibold text-[#1132d4] underline-offset-4 hover:underline dark:text-[#7aa3ff]">
                          {card.linkLabel}
                        </a>)}
                      <div className="mt-auto">
                      {pending ? (<div className="mt-4 space-y-3 rounded-xl border border-white/50 bg-white/70 p-4 dark:border-white/10 dark:bg-[#0d1429]/70">
                          <p className="text-sm">
                            Pending request submitted on <span className="font-semibold">{new Date(pending.createdAt).toLocaleString()}</span>
                          </p>
                          {pending.reason && (<p className="text-sm text-slate-500 dark:text-slate-300">{pending.reason}</p>)}
                          <button type="button" onClick={() => handleCancelRequest(pending.id)} disabled={requestLoading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-white/20">
                            Cancel Pending Request
                          </button>
                        </div>) : (<div className="mt-4 space-y-3">
                          <textarea value={requestNotes[card.type]} onChange={(event) => setRequestNotes((current) => ({ ...current, [card.type]: event.target.value }))} rows={4} placeholder="Optional note for the admin reviewing your request" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-[#1132d4] dark:border-white/20 dark:bg-[#0d1429]"/>
                          <button type="button" onClick={() => handleSubmitAccountRequest(card.type)} disabled={requestLoading} className="rounded-xl bg-[#1132d4] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                            {card.buttonLabel}
                          </button>
                        </div>)}
                      </div>
                    </div>);
            })}
              </div>
            </article>

            <article className="rounded-2xl border border-black/10 bg-white/85 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#0f1e3d]/75">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">Request History</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-300">Track every submitted account action request.</p>
                </div>
                <button type="button" onClick={refreshAccountRequests} disabled={requestLoading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-white/20">
                  Refresh
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {accountRequests.length === 0 ? (<div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-white/20 dark:text-slate-300">
                    No account requests submitted yet.
                  </div>) : (accountRequests.map((request) => (<div key={request.id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#1132d4] dark:text-[#7aa3ff]">
                            {formatRequestType(request.type)}
                          </p>
                          <p className="mt-1 text-base font-semibold">{formatRequestStatus(request.status)}</p>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                          {new Date(request.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {request.reason && (<p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{request.reason}</p>)}
                      {request.adminComment && (<p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-[#0d1429] dark:text-slate-300">
                          Admin note: {request.adminComment}
                        </p>)}
                    </div>)))}
              </div>
            </article>
          </div>)}
      </div>
    </section>);
}
