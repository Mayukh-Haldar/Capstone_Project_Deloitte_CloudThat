@echo off
echo ========================================
echo Starting All Backend Services
echo ========================================
echo.

REM Change to the backend directory
cd /d "%~dp0"

echo Starting Auth Service (Spring Boot)...
start "" cmd /k "title Auth Service && cd /d services\auth-service && mvn spring-boot:run"

echo Starting Event Service (Spring Boot)...
start "" cmd /k "title Event Service && cd /d services\event-service && mvn spring-boot:run"

echo Starting Finance Service (Spring Boot)...
start "" cmd /k "title Finance Service && cd /d services\finance-service && mvn spring-boot:run"

echo Starting Notification Service (Node.js)...
start "" cmd /k "title Notification Service && cd /d services\notification-service && npm run dev"

echo Starting Ticketing Service (.NET)...
start "" cmd /k "title Ticketing Service && cd /d services\ticketing-service && dotnet watch run --project src\EventZen.Ticketing.Api\EventZen.Ticketing.Api.csproj"

echo Starting Venue Vendor Service (Node.js)...
start "" cmd /k "title Venue Vendor Service && cd /d services\venue-vendor-service && npm run dev"

echo.
echo ========================================
echo All 6 services are starting in separate CMD windows
echo ========================================
echo   Spring Boot: Auth, Event, Finance
echo   Node.js:     Notification, Venue Vendor
echo   .NET:        Ticketing
echo ========================================
pause
