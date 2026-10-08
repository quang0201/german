# Local production-matrix review

This isolated Docker app serves the actual frontend build with a local-only mock backend. It has no database configuration and never connects to the shared or production database. All API writes are rejected with `403`.

Build and run from the repository root:

```powershell
docker build -f tools/local-matrix-review/Dockerfile -t german-matrix-demo:local .
docker run --rm --name german-matrix-demo -p 127.0.0.1:18082:8080 german-matrix-demo:local
```

Open `http://localhost:18082` and sign in with:

- Username: `demo`
- Password: `review2026`

The weekly matrix contains 30 fictional production entries, several attendance/status examples, and a separate hourly employee. The page is marked `LOCAL DEMO · DỮ LIỆU GIẢ · CHẾ ĐỘ CHỈ ĐỌC`. Stopping the container discards the demo session; no data is persisted.
