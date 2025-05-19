import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize SendGrid with API key
const sendgridApiKey = process.env.SENDGRID_API_KEY || '';
console.log('Setting SendGrid API key (masked):', sendgridApiKey ? `${sendgridApiKey.substring(0, 4)}...${sendgridApiKey.substring(sendgridApiKey.length - 4)}` : 'MISSING');
sgMail.setApiKey(sendgridApiKey);

export interface EmailData {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Send an email using SendGrid
 */
export const sendEmail = async (emailData: EmailData): Promise<boolean> => {
  try {
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    
    console.log('Preparing to send email:');
    console.log('- From:', fromEmail);
    console.log('- To:', emailData.to);
    console.log('- Subject:', emailData.subject);
    
    if (!fromEmail) {
      console.error('SENDGRID_FROM_EMAIL environment variable is not defined');
      return false;
    }
    
    if (!process.env.SENDGRID_API_KEY) {
      console.error('SENDGRID_API_KEY environment variable is not defined or empty');
      return false;
    }
    
    const msg = {
      to: emailData.to,
      from: fromEmail,
      subject: emailData.subject,
      text: emailData.text || '',
      html: emailData.html || ''
    };
    
    console.log('Calling SendGrid send API...');
    
    try {
      const response = await sgMail.send(msg);
      console.log('SendGrid API Response:', response);
      console.log(`Email sent to ${emailData.to} successfully!`);
      return true;
    } catch (sendError: any) {
      console.error('SendGrid API error:', sendError);
      
      if (sendError.response) {
        console.error('SendGrid response body:', sendError.response.body);
        console.error('SendGrid status code:', sendError.code);
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error in sendEmail function:', error);
    return false;
  }
};

/**
 * Send an invitation email
 */
export const sendInvitationEmail = async (
  to: string, 
  inviterName: string,
  inviteToken: string
): Promise<boolean> => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const inviteLink = `${frontendUrl}/invite?token=${inviteToken}`;
  
  const subject = `You've been invited to join a team`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Team Invitation</h2>
      <p>Hello,</p>
      <p>${inviterName || 'Someone'} has invited you to join their team.</p>
      <p>Click the button below to accept the invitation:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteLink}" style="background-color: #5a67d8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Accept Invitation
        </a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p>${inviteLink}</p>
      <p>This invitation will expire in 7 days.</p>
      <p>If you did not request this invitation, you can ignore this email.</p>
    </div>
  `;
  
  const text = `
    Hello,
    
    ${inviterName || 'Someone'} has invited you to join their team.
    
    Click the link below to accept the invitation:
    ${inviteLink}
    
    This invitation will expire in 7 days.
    
    If you did not request this invitation, you can ignore this email.
  `;
  
  return sendEmail({ to, subject, html, text });
}; 