FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY src/EventZen.Ticketing.Api/EventZen.Ticketing.Api.csproj src/EventZen.Ticketing.Api/
RUN dotnet restore src/EventZen.Ticketing.Api/EventZen.Ticketing.Api.csproj

COPY src/EventZen.Ticketing.Api src/EventZen.Ticketing.Api

RUN dotnet publish src/EventZen.Ticketing.Api/EventZen.Ticketing.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

EXPOSE 8084

ENTRYPOINT ["dotnet", "EventZen.Ticketing.Api.dll"]
