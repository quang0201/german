FROM oven/bun:1.3.14 AS frontend-build
WORKDIR /src/frontend
COPY src/frontend/package.json src/frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY src/frontend/ ./
RUN bun run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src
COPY . .
RUN dotnet restore German.sln
COPY --from=frontend-build /src/frontend/dist ./src/backend/German.Api/wwwroot
RUN dotnet publish src/backend/German.Api/German.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=backend-build /app/publish ./
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "German.Api.dll"]
