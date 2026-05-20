import type { AuthenticatedRole } from '@/common/types/authenticated-user.type';

export interface IUser {
  _id?: string;
  username: string;
  email?: string;
  name?: string;
  role?: string | AuthenticatedRole | null;
  partnerId?: string | null;
}
