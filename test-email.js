import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  secure: false,
  auth: {
    user: 'bernhard.stracke@ethereal.email',
    pass: 'sgHX1Z42wCuYydRJ3c',
  },
});

const info = await transporter.sendMail({
  from: '"Saukele" <noreply@saukele.kz>',
  to: 'bernhard.stracke@ethereal.email',
  subject: 'Test from Saukele',
  html: '<h1>Test</h1><p>This is a test email.</p>',
});

console.log('✓ Email sent:', info.messageId);
console.log('Preview URL:', nodemailer.getTestMessageUrl(info));

await transporter.close();
