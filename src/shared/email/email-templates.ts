export const emailTemplates = {
  verifyEmail(firstName: string, token: string, baseUrl: string): string {
    const link = `${baseUrl}/auth/verify-email?token=${token}`;
    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#4F46E5">Welcome to PawGo, ${firstName}! 🐾</h2>
        <p>Please verify your email address to activate your account.</p>

        <a href="${link}" style="background:#4F46E5;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold;font-size:16px">
          Verify Email Address
        </a>

        <p style="margin-top:28px;color:#555">
          <strong>Using the PawGo mobile app?</strong><br/>
          Copy the token below and paste it in the app:
        </p>
        <div style="background:#f4f4f4;border:1px solid #ddd;border-radius:6px;padding:14px;font-family:monospace;font-size:14px;word-break:break-all;color:#222">
          ${token}
        </div>

        <p style="margin-top:20px;color:#888;font-size:13px">
          This token expires in <strong>24 hours</strong>.<br/>
          If you did not create a PawGo account, you can safely ignore this email.
        </p>
      </div>
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

  appointmentConfirmation(
    ownerName: string,
    appointmentNumber: string,
    petName: string,
    doctorName: string,
    clinicName: string,
    clinicAddress: string,
    date: string,
    startTime: string,
    reason: string,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#4F46E5">Appointment Confirmed 🐾</h2>
        <p>Hi ${ownerName},</p>
        <p>Your appointment has been booked successfully. Here are the details:</p>

        <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:20px;margin:20px 0">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#555;width:140px">Appointment #</td><td style="padding:6px 0;font-weight:bold;font-family:monospace">${appointmentNumber}</td></tr>
            <tr><td style="padding:6px 0;color:#555">Pet</td><td style="padding:6px 0">${petName}</td></tr>
            <tr><td style="padding:6px 0;color:#555">Doctor</td><td style="padding:6px 0">${doctorName}</td></tr>
            <tr><td style="padding:6px 0;color:#555">Clinic</td><td style="padding:6px 0">${clinicName}</td></tr>
            <tr><td style="padding:6px 0;color:#555">Address</td><td style="padding:6px 0">${clinicAddress}</td></tr>
            <tr><td style="padding:6px 0;color:#555">Date</td><td style="padding:6px 0;font-weight:bold">${date}</td></tr>
            <tr><td style="padding:6px 0;color:#555">Time</td><td style="padding:6px 0;font-weight:bold">${startTime}</td></tr>
            <tr><td style="padding:6px 0;color:#555">Reason</td><td style="padding:6px 0">${reason}</td></tr>
          </table>
        </div>

        <p style="color:#555;font-size:13px">
          Please arrive 5–10 minutes early. If you need to reschedule or cancel, please do so at least 2 hours in advance through the PawGo app.
        </p>
        <p style="color:#888;font-size:12px;margin-top:20px">
          This is an automated confirmation. Please do not reply to this email.
        </p>
      </div>
    `;
  },

  staffInvite(
    firstName: string,
    clinicName: string,
    role: string,
    email: string,
    temporaryPassword: string,
    portalUrl: string,
  ): string {
    const roleLabel = role
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#4F46E5">Welcome to PawGo 🐾</h2>
        <p>Hi ${firstName},</p>
        <p>
          You've been added as a <strong>${roleLabel}</strong> at
          <strong>${clinicName}</strong> on the PawGo platform.
        </p>
        <p>Use the credentials below to log into the clinic portal:</p>

        <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:20px;margin:20px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:6px 0;color:#555;width:120px">Portal URL</td>
              <td style="padding:6px 0">
                <a href="${portalUrl}" style="color:#4F46E5">${portalUrl}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#555">Email</td>
              <td style="padding:6px 0;font-family:monospace;font-size:14px">${email}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#555">Temp Password</td>
              <td style="padding:6px 0">
                <div style="background:#fff;border:1px solid #ccc;border-radius:4px;padding:8px 12px;font-family:monospace;font-size:15px;letter-spacing:1px">
                  ${temporaryPassword}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <p style="color:#d97706;font-size:13px">
          ⚠️ You will be asked to change this password immediately after your first login.
        </p>

        <a href="${portalUrl}" style="background:#4F46E5;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold">
          Log In to Clinic Portal
        </a>

        <p style="margin-top:24px;color:#888;font-size:12px">
          If you believe this was sent in error, please ignore this email or contact your clinic administrator.
        </p>
      </div>
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

  orderPlaced(
    firstName: string,
    orderNumber: string,
    shopName: string,
    items: Array<{ name: string; qty: number; price: number }>,
    subtotal: number,
    discount: number,
    totalAmount: number,
    address: string,
    paymentMethod: string,
  ): string {
    const rows = items
      .map(
        (i) =>
          `<tr><td style="padding:6px 0">${i.name}</td><td style="padding:6px 0;text-align:center">${i.qty}</td><td style="padding:6px 0;text-align:right">₹${i.price.toFixed(2)}</td></tr>`,
      )
      .join('');
    const discountRow =
      discount > 0
        ? `<tr><td colspan="2" style="padding:4px 0;color:#16a34a">Discount</td><td style="padding:4px 0;text-align:right;color:#16a34a">−₹${discount.toFixed(2)}</td></tr>`
        : '';
    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#4F46E5">Order Placed Successfully 🛍️</h2>
        <p>Hi ${firstName}, thanks for your order!</p>
        <p>Your order from <strong>${shopName}</strong> has been received and is being processed.</p>

        <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:20px;margin:20px 0">
          <p style="margin:0 0 12px;font-weight:bold;font-size:15px">Order #${orderNumber}</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead>
              <tr style="border-bottom:1px solid #dee2e6">
                <th style="text-align:left;padding-bottom:6px">Item</th>
                <th style="text-align:center;padding-bottom:6px">Qty</th>
                <th style="text-align:right;padding-bottom:6px">Price</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot style="border-top:1px solid #dee2e6">
              <tr><td colspan="2" style="padding:4px 0;color:#555">Subtotal</td><td style="padding:4px 0;text-align:right">₹${subtotal.toFixed(2)}</td></tr>
              ${discountRow}
              <tr><td colspan="2" style="padding:6px 0;font-weight:bold">Total</td><td style="padding:6px 0;text-align:right;font-weight:bold">₹${totalAmount.toFixed(2)}</td></tr>
            </tfoot>
          </table>
        </div>

        <table style="width:100%;font-size:14px;border-collapse:collapse">
          <tr><td style="padding:4px 0;color:#555;width:130px">Delivery to</td><td style="padding:4px 0">${address}</td></tr>
          <tr><td style="padding:4px 0;color:#555">Payment</td><td style="padding:4px 0">${paymentMethod}</td></tr>
        </table>

        <p style="margin-top:20px;color:#888;font-size:12px">
          Track your order in the PawGo app. If you have any questions, contact us at support@pawgo.app.
        </p>
      </div>
    `;
  },

  orderStatusUpdate(
    firstName: string,
    orderNumber: string,
    shopName: string,
    newStatus: string,
    message: string,
  ): string {
    const statusColor: Record<string, string> = {
      CONFIRMED: '#16a34a',
      PACKED: '#2563eb',
      OUT_FOR_DELIVERY: '#d97706',
      DELIVERED: '#16a34a',
      CANCELLED: '#dc2626',
    };
    const color = statusColor[newStatus] ?? '#4F46E5';
    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2 style="color:${color}">Order Update: ${newStatus.replace(/_/g, ' ')}</h2>
        <p>Hi ${firstName},</p>
        <p>${message}</p>
        <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:16px;margin:16px 0">
          <strong>Order #${orderNumber}</strong> from ${shopName}
        </div>
        <p style="color:#888;font-size:12px">Track your order in the PawGo app.</p>
      </div>
    `;
  },

  homeVisitConfirmed(
    firstName: string,
    petName: string,
    clinicName: string,
    doctorName: string,
    scheduledAt: string,
    address: string,
    fee: number,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#4F46E5">Home Visit Confirmed 🏠🐾</h2>
        <p>Hi ${firstName},</p>
        <p>Great news! A vet has been assigned to your home visit request for <strong>${petName}</strong>.</p>

        <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:20px;margin:20px 0">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#555;width:120px">Pet</td><td style="padding:6px 0">${petName}</td></tr>
            <tr><td style="padding:6px 0;color:#555">Clinic</td><td style="padding:6px 0">${clinicName}</td></tr>
            <tr><td style="padding:6px 0;color:#555">Doctor</td><td style="padding:6px 0">${doctorName}</td></tr>
            <tr><td style="padding:6px 0;color:#555">Scheduled</td><td style="padding:6px 0;font-weight:bold">${scheduledAt}</td></tr>
            <tr><td style="padding:6px 0;color:#555">Address</td><td style="padding:6px 0">${address}</td></tr>
            <tr><td style="padding:6px 0;color:#555">Fee</td><td style="padding:6px 0;font-weight:bold">₹${fee.toFixed(2)}</td></tr>
          </table>
        </div>

        <p style="color:#555;font-size:13px">
          Please ensure someone is available at the address at the scheduled time.
          If you need to cancel, please do so at least 2 hours in advance through the PawGo app.
        </p>
        <p style="color:#888;font-size:12px">This is an automated notification. Please do not reply to this email.</p>
      </div>
    `;
  },

  payoutProcessed(
    firstName: string,
    status: 'APPROVED' | 'REJECTED' | 'PAID',
    amount: number,
    adminNote?: string,
  ): string {
    const statusConfig: Record<string, { color: string; title: string; body: string }> = {
      APPROVED: {
        color: '#16a34a',
        title: 'Payout Approved ✅',
        body: `Your payout request of <strong>₹${amount.toFixed(2)}</strong> has been approved and will be transferred to your bank account within 2–3 business days.`,
      },
      REJECTED: {
        color: '#dc2626',
        title: 'Payout Request Rejected',
        body: `Your payout request of <strong>₹${amount.toFixed(2)}</strong> has been rejected.`,
      },
      PAID: {
        color: '#2563eb',
        title: 'Payout Transferred 💸',
        body: `Your payout of <strong>₹${amount.toFixed(2)}</strong> has been transferred to your bank account.`,
      },
    };
    const cfg = statusConfig[status];
    const noteRow = adminNote
      ? `<p style="margin-top:12px;padding:12px;background:#fef9c3;border-radius:6px;font-size:13px"><strong>Note from admin:</strong> ${adminNote}</p>`
      : '';
    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2 style="color:${cfg.color}">${cfg.title}</h2>
        <p>Hi ${firstName},</p>
        <p>${cfg.body}</p>
        ${noteRow}
        <p style="margin-top:20px;color:#888;font-size:12px">
          View your earnings history in the PawGo delivery partner app.
        </p>
      </div>
    `;
  },

  ownerInvite(
    firstName: string,
    entityName: string,
    role: 'CLINIC_OWNER' | 'SHOP_OWNER',
    email: string,
    temporaryPassword: string,
    portalUrl: string,
  ): string {
    const roleLabel = role === 'CLINIC_OWNER' ? 'Clinic Owner' : 'Shop Owner';
    const portalLabel = role === 'CLINIC_OWNER' ? 'Clinic Portal' : 'Shop Portal';
    const entityLabel = role === 'CLINIC_OWNER' ? 'clinic' : 'shop';
    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#4F46E5">Welcome to PawGo 🐾</h2>
        <p>Hi ${firstName},</p>
        <p>
          Your ${entityLabel} <strong>${entityName}</strong> has been registered on the PawGo platform.
          You have been set up as a <strong>${roleLabel}</strong>.
        </p>
        <p>Use the credentials below to log in to your ${portalLabel}:</p>

        <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:20px;margin:20px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:6px 0;color:#555;width:130px">${portalLabel}</td>
              <td style="padding:6px 0">
                <a href="${portalUrl}" style="color:#4F46E5">${portalUrl}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#555">Email</td>
              <td style="padding:6px 0;font-family:monospace;font-size:14px">${email}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#555">Temp Password</td>
              <td style="padding:6px 0">
                <div style="background:#fff;border:1px solid #ccc;border-radius:4px;padding:8px 12px;font-family:monospace;font-size:15px;letter-spacing:1px">
                  ${temporaryPassword}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <p style="color:#d97706;font-size:13px">
          ⚠️ You will be asked to change this password immediately after your first login.
        </p>

        <a href="${portalUrl}" style="background:#4F46E5;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold">
          Log In to ${portalLabel}
        </a>

        <p style="margin-top:24px;color:#888;font-size:12px">
          If you have any questions, contact us at support@pawgo.app.
        </p>
      </div>
    `;
  },

  fieldAgentInvite(
    firstName: string,
    email: string,
    temporaryPassword: string,
    adminPortalUrl: string,
    assignedCity?: string,
    assignedState?: string,
  ): string {
    const territory = [assignedCity, assignedState].filter(Boolean).join(', ');
    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#4F46E5">Welcome to PawGo Field Team 🐾</h2>
        <p>Hi ${firstName},</p>
        <p>
          You have been onboarded as a <strong>Field Agent</strong> on the PawGo platform.
          You can now onboard clinics and shops in your area and manage them through the admin portal.
        </p>
        ${territory ? `<p>Your assigned territory: <strong>${territory}</strong></p>` : ''}
        <p>Use the credentials below to log in:</p>

        <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:20px;margin:20px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:6px 0;color:#555;width:130px">Admin Portal</td>
              <td style="padding:6px 0">
                <a href="${adminPortalUrl}" style="color:#4F46E5">${adminPortalUrl}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#555">Email</td>
              <td style="padding:6px 0;font-family:monospace;font-size:14px">${email}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#555">Temp Password</td>
              <td style="padding:6px 0">
                <div style="background:#fff;border:1px solid #ccc;border-radius:4px;padding:8px 12px;font-family:monospace;font-size:15px;letter-spacing:1px">
                  ${temporaryPassword}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <p style="color:#d97706;font-size:13px">
          ⚠️ You will be asked to change this password immediately after your first login.
        </p>

        <a href="${adminPortalUrl}" style="background:#4F46E5;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold">
          Log In to Admin Portal
        </a>

        <p style="margin-top:24px;color:#888;font-size:12px">
          If you have any questions, contact your PawGo admin or support@pawgo.app.
        </p>
      </div>
    `;
  },

  deliveryPartnerInvite(
    firstName: string,
    shopName: string,
    email: string,
    temporaryPassword: string,
    appStoreUrl?: string,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
        <h2 style="color:#4F46E5">Welcome to PawGo Delivery 🛵</h2>
        <p>Hi ${firstName},</p>
        <p>
          You have been registered as a Delivery Partner for <strong>${shopName}</strong> on the PawGo platform.
        </p>
        <p>Use the credentials below to log in to the PawGo mobile app:</p>

        <div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:20px;margin:20px 0">
          <table style="width:100%;border-collapse:collapse">
            <tr>
              <td style="padding:6px 0;color:#555;width:130px">Email</td>
              <td style="padding:6px 0;font-family:monospace;font-size:14px">${email}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#555">Temp Password</td>
              <td style="padding:6px 0">
                <div style="background:#fff;border:1px solid #ccc;border-radius:4px;padding:8px 12px;font-family:monospace;font-size:15px;letter-spacing:1px">
                  ${temporaryPassword}
                </div>
              </td>
            </tr>
          </table>
        </div>

        <p style="color:#d97706;font-size:13px">
          ⚠️ You will be asked to change this password on your first login.
        </p>

        ${appStoreUrl ? `<p style="margin-top:8px"><a href="${appStoreUrl}" style="background:#4F46E5;color:#fff;padding:12px 28px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:bold">Download PawGo App</a></p>` : ''}

        <p style="margin-top:24px;color:#888;font-size:12px">
          If you believe this was sent in error, please contact ${shopName} or support@pawgo.app.
        </p>
      </div>
    `;
  },
};
