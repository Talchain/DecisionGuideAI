// Simple SMTP test script for debugging Nodemailer issues
const nodemailer = require('nodemailer');
require('dotenv').config();

// Get SMTP URL from environment or command line
const smtpUrl = process.env.SMTP_URL || process.argv[2];
const testEmail = process.argv[3] || 'test@example.com';

if (!smtpUrl) {
  console.error('SMTP URL is required. Set SMTP_URL environment variable or pass as first argument.');
  process.exit(1);
}

console.log(`Testing SMTP connection to ${smtpUrl.replace(/:[^:@]+@/, ':***@')}`);
console.log(`Will send test email to ${testEmail}`);

// Parse SMTP URL to check format
function parseSmtpUrl(url) {
  try {
    const [protocol, rest] = url.split('://');
    const [auth, host] = rest.split('@');
    const [user, pass] = auth.split(':');
    return {
      protocol,
      user,
      hasPassword: !!pass,
      host,
      isValid: !!(protocol && auth && host)
    };
  } catch (e) {
    return { isValid: false, error: e.message };
  }
}

console.log('SMTP URL format check:', parseSmtpUrl(smtpUrl));

// Create transporter
let transporter;
try {
  console.log('Creating transporter...');
  transporter = nodemailer.createTransport(smtpUrl);
  console.log('Transporter created successfully:', {
    type: typeof transporter,
    hasOptions: !!transporter?.options,
    hasSendMail: typeof transporter?.sendMail === 'function'
  });
} catch (error) {
  console.error('Failed to create transporter:', error);
  process.exit(1);
}

// Verify connection
async function verifyConnection() {
  try {
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('SMTP connection verified successfully!');
    return true;
  } catch (error) {
    console.error('SMTP verification failed:', error);
    return false;
  }
}

// Send test email
async function sendTestEmail() {
  try {
    console.log(`Sending test email to ${testEmail}...`);
    
    const info = await transporter.sendMail({
      from: '"SMTP Test" <noreply@decisionguide.ai>',
      to: testEmail,
      subject: 'SMTP Test Email',
      text: 'This is a test email to verify SMTP configuration.',
      html: '<p>This is a test email to verify SMTP configuration.</p>'
    });
    
    console.log('Email sent successfully:', {
      messageId: info.messageId,
      response: info.response
    });
    return true;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

// Run tests
async function runTests() {
  const verified = await verifyConnection();
  if (verified) {
    await sendTestEmail();
  }
}

runTests().catch(console.error);