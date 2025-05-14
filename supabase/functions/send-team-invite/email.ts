// Email helper module for sending team invitations
import nodemailer from "npm:nodemailer@6.9.9";

// Environment variables
const smtpUrl = Deno.env.get("SMTP_URL")!;
const fromEmail = Deno.env.get("FROM_EMAIL") || "noreply@decisionguide.ai";
const appName = Deno.env.get("APP_NAME") || "DecisionGuide.AI";

// Email template for team invitations
const getInvitationEmailTemplate = ({
  teamName,
  inviterName,
  inviterEmail,
  role,
  acceptLink,
}: {
  teamName: string;
  inviterName: string;
  inviterEmail: string;
  role: string;
  acceptLink: string;
}) => `
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #4f46e5;">${appName} Team Invitation</h2>
      <p>Hello,</p>
      <p><strong>${inviterName}</strong> (${inviterEmail}) has invited you to join <strong>${teamName}</strong> as a <strong>${role}</strong>.</p>
      <p>Click the button below to accept this invitation:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${acceptLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Accept Invitation</a>
      </p>
      <p>If you don't have an account yet, you'll be able to create one after accepting the invitation.</p>
      <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      <p>Best regards,<br>The ${appName} Team</p>
    </div>
  </body>
</html>`;

// Email client class
export class EmailClient {
  private transporter: nodemailer.Transporter;
  
  constructor() {
    this.transporter = nodemailer.createTransport(smtpUrl);
  }
  
  async connect() {
    await this.transporter.verify();
  }
  
  async close() {
    this.transporter.close();
  }
  
  async sendInvitationEmail({
    to,
    teamName,
    inviterName,
    inviterEmail,
    role,
    acceptLink,
  }: {
    to: string;
    teamName: string;
    inviterName: string;
    inviterEmail: string;
    role: string;
    acceptLink: string;
  }) {
    try {
      await this.connect();
      
      await this.transporter.sendMail({
        from: fromEmail,
        to: to,
        subject: `You've been invited to join ${teamName} on ${appName}`,
        html: getInvitationEmailTemplate({
          teamName,
          inviterName,
          inviterEmail,
          role,
          acceptLink,
        }),
      });
      
      await this.close();
      return { success: true };
    } catch (error) {
      console.error('Error sending invitation email:', error);
      throw error;
    }
  }
}

// Factory function to create email client
export function createEmailClient() {
  return new EmailClient();
}