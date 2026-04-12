import { AuthError } from "next-auth";

// Tạo một class lỗi chung
export class CustomAuthError extends AuthError {
  static type: string;

  constructor(message?: any) {
    super();
    this.type = message;
  }
}

// Tạo class lỗi cụ thể khi sai Email/Mật khẩu
export class InvalidEmailPasswordError extends AuthError {
  static type = "Email/Password khong hop le";
}

export class InactiveAccountError extends AuthError {
  static type = "Tai khoan chua duoc kich hoat";
}