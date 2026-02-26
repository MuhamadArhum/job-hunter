const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendApplicationEmail({ to, subject, body, cvPath, userName, companyName }) {
    try {
      // Validate inputs
      if (!to || !subject || !body) {
        throw new Error('To, subject, and body are required');
      }

      // Email configuration
      const mailOptions = {
        from: {
          name: userName || 'Job Applicant',
          address: process.env.EMAIL_USER
        },
        to: to,
        subject: subject,
        html: this.formatEmailBody(body, userName, companyName),
        attachments: []
      };

      // Attach CV if provided
      if (cvPath && fs.existsSync(cvPath)) {
        mailOptions.attachments.push({
          filename: path.basename(cvPath),
          path: cvPath,
          contentType: 'application/pdf'
        });
      }

      // Send email
      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`Application email sent successfully to ${to}`);
      return {
        success: true,
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected
      };
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error(`Failed to send application email: ${error.message}`);
    }
  }

  formatEmailBody(body, userName, companyName) {
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Application</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { margin-bottom: 30px; }
          .content { margin-bottom: 30px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
          .signature { margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <p><strong>${currentDate}</strong></p>
          </div>
          
          <div class="content">
            ${body.replace(/\n/g, '<br>')}
          </div>
          
          <div class="signature">
            <p>Best regards,</p>
            <p><strong>${userName || 'Job Applicant'}</strong></p>
          </div>
          
          <div class="footer">
            <p style="font-size: 12px; color: #666;">
              This email was sent automatically through the Job Application Agent system.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return html;
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('Email service connection verified');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }

  async testEmail() {
    try {
      const testResult = await this.sendApplicationEmail({
        to: process.env.EMAIL_USER, // Send to self for testing
        subject: 'Test Email - Job Application Agent',
        body: 'This is a test email to verify the email service is working correctly.',
        userName: 'Test User'
      });
      
      return testResult;
    } catch (error) {
      console.error('Test email failed:', error);
      throw error;
    }
  }
}

const emailService = new EmailService();
module.exports = { emailService };