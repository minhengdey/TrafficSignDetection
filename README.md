# TrafficSignDetection

## 1. Giới thiệu dự án

`TrafficSignDetection` là một hệ thống phát hiện biển báo giao thông trên video và camera thời gian thực. Mục tiêu của dự án là hỗ trợ phân tích, trích xuất và lưu kết quả nhận diện biển báo từ video tải lên hoặc stream camera (real-time). Ứng dụng cung cấp cả giao diện frontend (web) cho người dùng tải video, xem kết quả và quản lý, cùng backend (Spring Boot) thực hiện xử lý video, gọi API nhận diện (Roboflow) và lưu trữ kết quả vào cơ sở dữ liệu.

Ứng dụng hữu ích cho nghiên cứu, thử nghiệm các mô hình nhận diện, và làm cơ sở cho các hệ thống hỗ trợ lái xe hoặc thu thập dữ liệu giao thông.

## 2. Các chức năng chính

- **Upload video và detect video** – Người dùng upload video, server trích frame, gửi đến Roboflow để nhận diện, lưu kết quả và cho phép xem chi tiết từng frame.
- **Real-time camera detection** – Bật camera từ trình duyệt, gửi frame để nhận diện theo thời gian thực và vẽ bounding box lên overlay.
- **Kết quả chi tiết** – Lưu từng detection (loại biển, độ tin cậy, bounding box, frame/time) để thống kê hoặc truy xuất sau này.
- **Thống kê và lịch sử** – Hiển thị tổng số upload, tổng detection, và danh sách video đã xử lý.
- **Quản trị** – Quản lý videos, users, types of signs.

## 3. Công nghệ

### 3.1 Công nghệ sử dụng

- Java 17+
- Spring Boot
- Maven
- MySQL
- JavaCV / FFmpeg (dùng để trích frame từ video)
- Roboflow (API detect)
- HTML / CSS / JavaScript (Frontend)
- JWT / Cookie-based auth

### 3.2. Cấu trúc dự án

#### 3.2.1 Backend (Spring Boot)

```
Backend (Spring Boot)
│── pom.xml
│── src/main/java/org/example/trafficsigndetection
│   ├── config         # Cấu hình ứng dụng (security, jwt, cors, b2 config...)
│   ├── controller     # API controllers (upload, video, detection, frame detection)
│   ├── dto            # DTOs cho request/response
│   ├── entity         # JPA entities (Video, Detection, TrafficSignType, User...)
│   ├── repository     # Spring Data JPA repositories
│   ├── service        # Business logic (VideoProcessingService, FrameDetectionService)
│   ├── exception      # Custom exceptions, global handlers
│── src/main/resources/application.properties
```

**Backend** sử dụng Spring Boot để cung cấp API, xử lý upload, trích frame bằng JavaCV/FFmpeg, gọi Roboflow để detect và lưu kết quả.

#### 3.2.2 Frontend (Static files)

```
Frontend (Static - HTML/CSS/JS)
│── index.html
│── upload.html
│── results.html
│── css/
│── js/
```

**Frontend** là tập các trang tĩnh (HTML/CSS/JS) để người dùng upload video, bật camera realtime, và xem kết quả.

## 4. Sơ đồ thực thể - quan hệ (ER)

![Cơ sở dữ liệu](/images/er-diagram.png)

## 5. Hướng dẫn chạy (Quick start)

### 5.1 Thiết lập môi trường

- Cài Java 17+
- Cài Maven
- Thiết lập biến môi trường cho Roboflow trong file `application.properties` hoặc môi trường hệ thống:
    - `DB_URL`
    - `DB_USERNAME`
    - `DB_PASSWORD`
	- `ROBOFLOW_API_KEY`
	- `ROBOFLOW_PROJECT_ID`
	- `ROBOFLOW_MODEL_VERSION`
    - `...`

### 5.2 Run Backend

Maven (Windows PowerShell):

```powershell
cd Backend
./mvnw.cmd spring-boot:run
```

Hoặc build jar và chạy:

```powershell
./mvnw.cmd clean package -DskipTests
java -jar target/*.jar
```

### 5.3 Frontend

Frontend là các file tĩnh trong thư mục `Frontend/`.

Hướng dẫn chạy (PowerShell dùng Python):

```powershell
cd Frontend
python -m http.server 5500
# rồi mở http://localhost:5500/
```

## 6. Kết quả và Giao diện

### 6.1 Giao diện trang chủ

Trang hiển thị đầu tiên khi truy cập vào hệ thống

![Trang chủ](/images/home-page.png)

### 6.2 Giao diện đăng ký

Màn hình cho phép người dùng đăng ký

![Đăng ký](/images/register-page.png)

### 6.3 Giao diện đăng nhập

Màn hình cho phép người dùng đăng nhập

![Đăng nhập](/images/login-page.png)

### 6.4 Giao diện thông tin và cập nhật thông tin người dùng

Màn hình cho phép người dùng cập nhật thông tin cá nhân

![Cập nhật thông tin](/images/update-profile.png)

Màn hình cho phép người dùng đổi mật khẩu cá nhân

![Đổi mật khẩu](/images/change-pasword.png)

### 6.5 Giao diện upload và detect video

Giao diện cho phép upload video

![Upload](/images/upload-page.png)

Giao diện nhận diện biển báo real-time sử dụng  camera

![Nhận diện real-time](/images/real-time-detect.png)

Khi muốn detect bằng video, ấn upload video rồi hệ thống sẽ chuyển hướng sang màn hình uploading video

![Uploading video](/images/uploading-page.png)

Sau khi upload video xong thì hệ thống bắt đầu thực hiện detect video

![Processing video](/images/processing-page.png)

Và cuối cùng sau khi thực hiện detect xong, giao diện kết quả hiển thị lên

![Kết quả](/images/result-page.png)

### 6.6 Giao diện lịch sử upload

Giao diện lịch sử upload: Khi ấn vào View Result thì giao diện kết quả như trên hiển thị ra, còn nếu án nút Reprocess thì sẽ thực hiện detect lại và cũng hiển thị ra giao diện kết quả vừa reprocess được

![Lịch sử](/images/history-page.png)

### 6.7 Giao diện cho role Admin

Màn hình tổng quan

![Overview](/images/admin-overview.png)

Màn hình quản lý người dùng

![Quản lý người dùng](/images/users-management.png)

Màn hình quản lý các video đã được đăng tải

![Quản lý video](/images/videos-management.png)

Màn hình quản lý các loại biển báo

![Quản lý biển báo](/images/signs-management.png)
---
