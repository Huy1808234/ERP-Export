import * as bcrypt from 'bcrypt';

const saltRounds = 10;

export const hashPasswordHelper = async (plainPassword: string) => {
  try {
    const hash = await bcrypt.hash(plainPassword, saltRounds);
    return hash;
  } catch (error) {
    console.log(error);
    throw new Error('Error hashing password');
  }
};

export const comparePasswordHelper = async (
  plainPassword: string,
  hashedPassword: string,
) => {
  try {
    // So sánh password thường với password đã được hash và trả về kết quả
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.log(error);
  }
};
