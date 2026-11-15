# One image serves the built React app and ASP.NET Core API.
FROM node:24-alpine AS web
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY global.json ./
COPY backend/Pitwall.Api/Pitwall.Api.csproj backend/Pitwall.Api/
RUN dotnet restore backend/Pitwall.Api/Pitwall.Api.csproj
COPY backend/ backend/
COPY data/ data/
COPY scripts/import-race.mjs scripts/import-race.mjs
RUN dotnet publish backend/Pitwall.Api/Pitwall.Api.csproj -c Release --no-restore -o /out /p:UseAppHost=false
COPY --from=web /src/frontend/dist/ /out/wwwroot/

FROM node:24-bookworm-slim AS ingestion-runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends curl libstdc++6 && rm -rf /var/lib/apt/lists/*
COPY --from=ingestion-runtime /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY --from=api /out/ ./
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER app
ENTRYPOINT ["dotnet", "Pitwall.Api.dll"]
