# Quy tắc Dự án (Project Rules)

1. **Không đưa câu lệnh của người dùng lên giao diện (No Prompt Echoing in UI)**:
   - Tuyệt đối không trích dẫn, lặp lại hoặc đưa nguyên văn câu lệnh, yêu cầu kỹ thuật của người dùng lên văn bản hiển thị của giao diện web (HTML/UI).
   - Nội dung hiển thị trên giao diện phải sử dụng ngôn ngữ tự nhiên, chuyên nghiệp, đóng vai trò là sản phẩm thực tế dành cho khách hàng và nhiếp ảnh gia.

2. **Không hiển thị mật khẩu công khai ở bất cứ đâu (No Public Passwords Anywhere)**:
   - Tuyệt đối không hiển thị mật khẩu, mã PIN gợi ý, hoặc thông tin đăng nhập mặc định dưới dạng văn bản công khai trên giao diện (trong popup đăng nhập, placeholder, tooltip, ghi chú, footer, hay thông báo).
   - Không điền sẵn (`value="..."`) mật khẩu vào các ô input trên giao diện.

3. **Quản lý quy tắc tập trung tại `GEMINI.md`**:
   - Luôn tuân thủ các quy tắc trong file `GEMINI.md` và chỉ cập nhật các quy tắc mới trực tiếp vào file này.

4. **Chỉ sửa đúng khu vực code được yêu cầu (Strict Scope Control)**:
   - Chỉ được phép chỉnh sửa đúng phần tử, chức năng và khu vực mã nguồn mà người dùng chỉ định cụ thể trong yêu cầu.
   - Tuyệt đối không tự ý đụng chạm, sửa đổi, tái cấu trúc hoặc can thiệp vào các khu vực code khác ngoài phạm vi khi chưa có sự đồng ý hoặc yêu cầu rõ ràng từ người dùng.

5. **Bắt buộc đọc lại toàn bộ Rule trong `GEMINI.md` trước khi thực hiện bất kỳ yêu cầu nào (Read Rules Before Action)**:
   - Sau mỗi yêu cầu từ người dùng, AI bắt buộc phải đọc và rà soát lại toàn bộ các quy tắc trong file `GEMINI.md` này trước khi bắt đầu phân tích, lập trình hoặc chỉnh sửa bất kỳ nội dung nào.
   - Đảm bảo mọi giải pháp và hành động luôn tuân thủ 100% tất cả các quy tắc đã đề ra.

4. **Chỉ sửa đúng khu vực code được yêu cầu (Strict Scope Control)**:
   - Chỉ được phép chỉnh sửa đúng phần tử, chức năng và khu vực mã nguồn mà người dùng chỉ định cụ thể trong yêu cầu.
   - Tuyệt đối không tự ý đụng chạm, sửa đổi, tái cấu trúc hoặc can thiệp vào các khu vực code khác ngoài phạm vi khi chưa có sự đồng ý hoặc yêu cầu rõ ràng từ người dùng.

5. **Bắt buộc đọc lại toàn bộ Rule trong `GEMINI.md` trước khi thực hiện bất kỳ yêu cầu nào (Read Rules Before Action)**:
   - Sau mỗi yêu cầu từ người dùng, AI bắt buộc phải đọc và rà soát lại toàn bộ các quy tắc trong file `GEMINI.md` này trước khi bắt đầu phân tích, lập trình hoặc chỉnh sửa bất kỳ nội dung nào.
   - Đảm bảo mọi giải pháp và hành động luôn tuân thủ 100% tất cả các quy tắc đã đề ra.
