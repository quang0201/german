# Deployment Guide

Tài liệu này là hướng dẫn vận hành chính cho German Production trên Linux bằng Docker Engine + Docker Compose v2.

Ứng dụng và PostgreSQL không nằm chung một Compose stack. `compose.yaml` chỉ chứa `german-app`. PostgreSQL có thể nằm trên cùng máy Linux hoặc trên một máy/IP/domain khác.

## 1. Yêu cầu

Máy deploy cần có:

```text
Linux
Git
Docker Engine
docker compose (Compose v2)
```

Kiểm tra:

```bash
git --version
docker --version
docker compose version
docker info
```

Nếu `docker info` báo permission denied, cấu hình quyền Docker cho user đang deploy trước khi tiếp tục.

## 2. Lấy code từ `dev`

Server integration hiện deploy từ `dev`:

```bash
cd ~/code/german
git fetch origin
git switch dev || git switch -c dev --track origin/dev
git pull --ff-only origin dev
```

Không dùng `deploy.sh update` khi đang ở `main` hoặc khi working tree có thay đổi chưa commit.

## 3. Tạo `.env`

Chạy:

```bash
./deploy.sh setup
```

Script hỏi lần lượt:

```text
PostgreSQL host [127.0.0.1]:
PostgreSQL port [5432]:
Database [german]:
Username [german]:
Password:
SSL mode (Disable/Require) [...]:
App port [8080]:
Bootstrap admin enabled [false]:
```

Password được nhập ẩn, không echo ra terminal.

### PostgreSQL trên cùng máy

Nếu PostgreSQL chạy trên chính máy deploy và đang listen ở host loopback, để trống host:

```text
PostgreSQL host [127.0.0.1]: <Enter>
```

Script dùng:

```text
127.0.0.1:5432
SSL Mode=Disable
```

`german-app` dùng Docker host networking trên Linux nên `127.0.0.1` bên trong app trỏ đúng tới network stack của máy host.

### PostgreSQL remote

Nhập IP hoặc domain, ví dụ:

```text
PostgreSQL host [127.0.0.1]: 10.0.0.20
```

hoặc:

```text
PostgreSQL host [127.0.0.1]: db.example.com
```

Host không phải loopback mặc định dùng:

```text
SSL Mode=Require
```

Có thể đổi thành `Disable` khi server PostgreSQL nội bộ không hỗ trợ TLS, nhưng với kết nối qua Internet nên giữ `Require`.

Sau khi tạo, `.env` có permission `0600` và không được commit vào Git.

Kiểm tra permission:

```bash
ls -l .env
```

## 4. Deploy lần đầu

Quy trình chuẩn:

```bash
./deploy.sh setup
./deploy.sh migrate
./deploy.sh seed      # chỉ khi BootstrapAdmin__Enabled=true
./deploy.sh deploy
```

Các mode độc lập:

```text
migrations  chỉ áp dụng EF Core migrations rồi exit
seed        chỉ chạy bootstrap seed rồi exit
app         chỉ chạy web app, không migrate/seed
```

Nếu migration thất bại, không chạy app mới cho tới khi lỗi migration/database được xử lý.

### Migration

```bash
./deploy.sh migrate
```

Script build image hiện tại rồi chạy:

```bash
docker compose run --rm --no-deps german-app migrations
```

Migration không seed và không start HTTP server.

### Seed Admin đầu tiên

Để tạo bootstrap Admin, chạy `./deploy.sh setup` với:

```text
Bootstrap admin enabled [false]: true
Bootstrap username [admin]: admin
Bootstrap password: ********
```

Password bootstrap phải có ít nhất 8 ký tự.

Sau migration:

```bash
./deploy.sh seed
```

Seeder hiện tại chỉ tạo bootstrap Admin khi database chưa có tài khoản. Chạy lại không tạo thêm Admin nếu tài khoản đã tồn tại.

Sau khi tạo Admin đầu tiên, nên sửa `.env`:

```text
BootstrapAdmin__Enabled=false
BootstrapAdmin__Password=''
```

### Start app

```bash
./deploy.sh deploy
```

Script build/recreate `german-app`, sau đó chờ Docker healthcheck. Nếu app exit hoặc không healthy trong thời gian giới hạn, script tự in status và log gần nhất rồi trả exit code khác 0.

## 5. Truy cập ứng dụng

`APP_PORT` là port ASP.NET Core bind trực tiếp trên máy host vì Compose dùng `network_mode: host`.

Mặc định:

```text
APP_PORT=8080
```

Kiểm tra health:

```bash
curl http://127.0.0.1:8080/health
```

Kỳ vọng:

```json
{"status":"ok"}
```

Từ máy khác trong LAN:

```text
http://IP-CUA-SERVER:8080
```

Nếu có firewall, mở `APP_PORT` theo chính sách mạng của server.

## 6. Cập nhật phiên bản

Khi server đang checkout branch `dev` và working tree sạch:

```bash
./deploy.sh update
```

`update` thực hiện:

```text
1. kiểm tra .env, Docker, branch dev và working tree sạch
2. git fetch origin dev
3. fast-forward local dev tới origin/dev
4. build image mới
5. stop german-app hiện tại
6. chạy migrations bằng image mới
7. nếu migration thành công: start german-app mới
8. chờ healthcheck
```

`update` không checkout `main`, không merge `main`, không tạo non-fast-forward merge và không tự chạy seed.

Nếu migration thất bại, app được giữ ở trạng thái stopped để tránh chạy code mới với schema chưa đúng. Sửa lỗi rồi chạy lại migration/deploy.

Với database production có dữ liệu quan trọng, thực hiện backup phù hợp trước các update có migration thay đổi schema lớn.

## 7. Status và logs

Xem trạng thái:

```bash
./deploy.sh status
```

Theo dõi log:

```bash
./deploy.sh logs
```

Nhấn `Ctrl+C` chỉ dừng việc follow log, không dừng container.

Có thể dùng Docker Compose trực tiếp khi cần:

```bash
docker compose ps german-app
docker compose logs --tail=100 german-app
docker compose stop german-app
docker compose start german-app
```

## 8. Các lệnh thấp hơn

Docker image mặc định chạy mode `app`. Có thể gọi trực tiếp:

```bash
docker compose build german-app
docker compose run --rm --no-deps german-app migrations
docker compose run --rm --no-deps german-app seed
docker compose up -d --force-recreate german-app
```

Khuyến nghị dùng `deploy.sh` để tránh bỏ sót validation và healthcheck.

## 9. Troubleshooting

### Không kết nối được PostgreSQL cùng máy

Kiểm tra PostgreSQL có chạy và port host có mở:

```bash
docker ps
ss -ltnp | grep 5432 || true
```

Nếu PostgreSQL container publish `127.0.0.1:5432->5432`, dùng host `127.0.0.1` trong `./deploy.sh setup`.

### PostgreSQL remote không kết nối được

Kiểm tra từ host:

```bash
nc -vz DB_HOST 5432
```

Đồng thời kiểm tra firewall, `pg_hba.conf`/provider access rules và SSL mode.

### Port app bị chiếm

Ví dụ `APP_PORT=8080`:

```bash
ss -ltnp | grep 8080 || true
```

Chọn port khác bằng `./deploy.sh setup` nếu cần.

### Migration thất bại

`./deploy.sh migrate` hoặc `./deploy.sh update` hiển thị output của process migration ngay trên terminal. Không chạy seed/app cho tới khi migration thành công.

### App không healthy

Script tự in `docker compose ps` và 100 dòng log gần nhất. Có thể xem thêm:

```bash
./deploy.sh logs
```

## 10. Giới hạn hiện tại

Deployment helper hiện không tự thực hiện:

```text
backup/restore PostgreSQL
rollback migration tự động
publish image lên registry
SSH deploy sang máy khác
secret manager
Kubernetes/systemd orchestration
```

Các phần này phải được bổ sung có chủ đích khi nhu cầu production yêu cầu.
