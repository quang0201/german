FROM oven/bun:1.3.14 AS frontend-build
WORKDIR /src/frontend
COPY src/frontend/package.json src/frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY src/frontend/ ./
RUN bun run build

FROM oven/bun:1.3.14
WORKDIR /app
COPY tools/local-matrix-review/server.mjs ./server.mjs
COPY tools/local-matrix-review/mockData.mjs ./mockData.mjs
COPY --from=frontend-build /src/frontend/dist ./public
ENV PORT=8080
EXPOSE 8080
CMD ["bun", "server.mjs"]
