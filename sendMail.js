const nodemailer = require("nodemailer");

async function sendMail({ from, to, subject, text }) {
  try {
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "Reachoutpro.ai@gmail.com",
        pass: "fhtkcqbdluziedjm",
      },
    });

    let mailOptions = {
      from,
      to,
      subject,
      text,
    };

    let info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error };
  }
}

module.exports = sendMail;
