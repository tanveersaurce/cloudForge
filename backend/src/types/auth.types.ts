export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccessTokenPayload {
  sub: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

export interface SessionIssueResult {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
  rememberMe: boolean;
}
