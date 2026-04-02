import * as brevo from '@getbrevo/brevo';

// Initialize Brevo API client
const brevoApiInstance = new brevo.TransactionalEmailsApi();
brevoApiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY || '');

export async function sendEmail(to, subject, html) {
  // Helper function to log email to console
  const logEmailToConsole = () => {
    console.log('\n=================================');
    console.log('📧 EMAIL (Development Mode)');
    console.log('=================================');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Content:', html.replace(/<[^>]*>/g, '').trim());
    console.log('=================================\n');
    
    return {
      id: `dev-${Date.now()}`,
      message: 'Email logged to console (development mode)',
    };
  };

  // Development mode: If Brevo is not configured, log to console instead
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
    return logEmailToConsole();
  }

  try {
    // Prepare email data for Brevo
    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: process.env.BREVO_SENDER_NAME || 'Tuabet Support Team',
      email: process.env.BREVO_SENDER_EMAIL
    };
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;

    // Send email via Brevo
    const result = await brevoApiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('✅ Email sent successfully via Brevo:', to, '| Message ID:', result.messageId);
    
    return {
      id: result.messageId,
      message: 'Email sent successfully via Brevo',
    };
  } catch (error) {
    console.error('❌ Brevo error (falling back to console logging):', error.message);
    // Fall back to console logging instead of throwing error
    return logEmailToConsole();
  }
}

export const convertEmailToLowerCase = (email) => {
  return email.toLowerCase();
};

export const sanitizeInput = (input) => {
  // Ensure input is a string
  if (typeof input !== 'string') return input;

  // Replace the potentially harmful characters with their HTML entities
  return input
    .replace(/</g, '&lt;') // Replaces < with &lt;
    .replace(/>/g, '&gt;') // Replaces > with &gt;
    .replace(/"/g, '&quot;') // Replaces " with &quot;
    .replace(/'/g, '&#39;') // Replaces ' with &#39;
    .replace(/&/g, '&amp;') // Replaces & with &amp;
    .replace(/\/script/g, '') // Removes 'script' tags (used for XSS attack)
    .trim(); // Remove leading/trailing whitespace
};

export const generateSecurityCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const getRandomNumber = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const generateAvatarUrl = (username) => {
  const bgR = Math.floor(Math.random() * 120);
  const bgG = Math.floor(Math.random() * 120);
  const bgB = Math.floor(Math.random() * 120);
  const backgroundColor = [bgR, bgG, bgB].map((c) => c.toString(16).padStart(2, '0')).join('');

  // Bright foreground (128-255)
  const fgR = Math.floor(Math.random() * 125) + 128;
  const fgG = Math.floor(Math.random() * 125) + 128;
  const fgB = Math.floor(Math.random() * 125) + 128;
  const foregroundColor = [fgR, fgG, fgB].map((c) => c.toString(16).padStart(2, '0')).join('');

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    username
  )}&background=${backgroundColor}&color=${foregroundColor}&size=200&bold=true`;
};

export const isValidCPF = (cpf) => {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

  let sum = 0,
    rest;

  for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cpf.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(cpf.substring(10, 11));
};
