export const emailTemplates = {
  verifyEmail(firstName: string, token: string, baseUrl: string): string {
    const link = `${baseUrl}/auth/verify-email?token=${token}`;
    return `
      <h2>Welcome to PawGo, ${firstName}!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${link}" style="background:#4F46E5;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
        Verify Email
      </a>
      <p>This link expires in <strong>24 hours</strong>.</p>
      <p>If you did not create an account, you can safely ignore this email.</p>
    `;
  },

  forgotPassword(firstName: string, token: string, baseUrl: string): string {
    const link = `${baseUrl}/auth/reset-password?token=${token}`;
    return `
      <h2>Reset Your PawGo Password</h2>
      <p>Hi ${firstName},</p>
      <p>We received a request to reset your password. Click the button below:</p>
      <a href="${link}" style="background:#EF4444;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">
        Reset Password
      </a>
      <p>This link expires in <strong>15 minutes</strong>.</p>
      <p>If you did not request a password reset, please ignore this email. Your password will not be changed.</p>
    `;
  },

  passwordChanged(firstName: string): string {
    return `
      <h2>Password Changed Successfully</h2>
      <p>Hi ${firstName},</p>
      <p>Your PawGo account password has been changed successfully.</p>
      <p>If you did not make this change, please contact support immediately.</p>
    `;
  },
};
