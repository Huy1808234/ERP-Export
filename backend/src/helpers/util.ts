import * as bcrypt from 'bcrypt';

const saltRounds = 10;

export const hashPasswordHelper = async (plainPassword: string) => {
  try {
    // 1. Mã hóa password và lưu kết quả vào một biến
    const hash = await bcrypt.hash(plainPassword, saltRounds);

    // 2. In ra log để kiểm tra (bạn có thể xóa dòng này khi đưa lên production)
    console.log('Hashed Password:', hash);

    // 3. Trả về kết quả đã mã hóa
    return hash;
  } catch (error) {
    console.log(error);
    // Nên throw error để nơi gọi hàm này biết quá trình hash đã thất bại
    throw new Error('Error hashing password');
  }
};

export const comparePasswordHelper = async (plainPassword: string, hashedPassword: string) => {
  try {
    // So sánh password thường với password đã được hash và trả về kết quả
    return await bcrypt.compare(plainPassword, hashedPassword);       
    
  } catch (error) {
    console.log(error)
  }
}